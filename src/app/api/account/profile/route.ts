import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  updateParentDisplayName,
  updateProfileById,
} from "@/lib/supabase/queries";
import {
  uploadProfileAvatar,
  removeProfileAvatarFromStorage,
  uploadStorefrontProfileAvatar,
  removeStorefrontProfileAvatarFromStorage,
  uploadStorefrontBannerImage,
  removeStorefrontBannerFromStorage,
} from "@/lib/storage";
import { moderateImageBase64, moderateText } from "@/lib/moderation";
import { DEFAULT_AVATAR_POOL } from "@/lib/profile-avatar";
import { awardXp, pickXpToastPayload, type XpAwardResult } from "@/lib/xp/award";

const DEFAULT_AVATAR_ALLOWLIST: ReadonlySet<string> = new Set(DEFAULT_AVATAR_POOL);

export const dynamic = "force-dynamic";

const MAX_DISPLAY_NAME_LEN = 80;
const MAX_CATCHPHRASE_LEN = 120;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
// Banners are wider than avatars (~16:5) and people upload higher-res
// source files for them, so we allow up to 4 MB rather than the 2 MB
// cap that's plenty for a circular avatar.
const MAX_BANNER_BYTES = 4 * 1024 * 1024;
const ALLOWED_AVATAR_MIME = /^image\/(png|jpe?g|webp)$/i;

function validateDisplayName(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "Display name is required" };
  }
  const value = raw.trim();
  if (!value) {
    return { ok: false, error: "Display name cannot be empty" };
  }
  if (value.length > MAX_DISPLAY_NAME_LEN) {
    return { ok: false, error: `Display name must be ${MAX_DISPLAY_NAME_LEN} characters or fewer` };
  }
  return { ok: true, value };
}

function validateCatchphrase(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Catchphrase must be text" };
  }
  const value = raw.trim();
  if (!value) {
    return { ok: true, value: null };
  }
  if (value.length > MAX_CATCHPHRASE_LEN) {
    return { ok: false, error: `Catchphrase must be ${MAX_CATCHPHRASE_LEN} characters or fewer` };
  }
  return { ok: true, value };
}

function estimateDataUrlBytes(dataUrl: string): number | null {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return null;
  const header = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (/;base64/i.test(header)) {
    return Math.floor((payload.replace(/\s/g, "").length * 3) / 4);
  }
  return payload.length;
}

/**
 * Shared mime/size/moderation gate for the personal AND storefront avatar
 * uploaders — same kid-safety rules apply to both photos. Banners reuse the
 * same MIME/moderation rules but with a larger size cap (see
 * `validateAndModerateBanner`).
 */
async function validateAndModerateImage(
  dataUrl: string,
  label: string,
  maxBytes: number,
  sizeLabel: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const mimeMatch = dataUrl.match(/^data:([^;,]+)/i);
  const mime = mimeMatch?.[1]?.split(";")[0].trim().toLowerCase() ?? "";
  if (!ALLOWED_AVATAR_MIME.test(mime)) {
    return { ok: false, error: `${label} must be PNG, JPG, or WebP.` };
  }
  const bytes = estimateDataUrlBytes(dataUrl);
  if (bytes !== null && bytes > maxBytes) {
    return { ok: false, error: `${label} must be ${sizeLabel} or smaller.` };
  }
  const moderation = await moderateImageBase64(dataUrl);
  if (!moderation.safe) {
    return {
      ok: false,
      error: "That image didn't pass our safety check. Try a different one.",
    };
  }
  return { ok: true };
}

async function validateAndModerateAvatar(
  dataUrl: string,
  label: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return validateAndModerateImage(dataUrl, label, MAX_AVATAR_BYTES, "2 MB");
}

async function validateAndModerateBanner(
  dataUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return validateAndModerateImage(dataUrl, "Storefront banner", MAX_BANNER_BYTES, "4 MB");
}

/**
 * PATCH — update signed-in user's creator profile: display name, catchphrase,
 * and avatar. Syncs display name + avatar to auth metadata and parent row.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "No creator profile" }, { status: 400 });
  }

  const profilePatch: Parameters<typeof updateProfileById>[2] = {};
  const authPatch: Record<string, string | null> = {};
  let displayName: string | undefined;
  // Track which XP rules to fire AFTER the row is saved successfully —
  // saves us from awarding XP for a save that ultimately 500s.
  let awardAvatarCustom = false;
  let awardStorefrontAvatar = false;
  let awardStorefrontBanner = false;

  if (body.displayName !== undefined) {
    const parsed = validateDisplayName(body.displayName);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    displayName = parsed.value;
    profilePatch.display_name = parsed.value;
    authPatch.full_name = parsed.value;
  }

  if (body.catchphrase !== undefined) {
    const parsed = validateCatchphrase(body.catchphrase);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    if (parsed.value) {
      const textCheck = await moderateText(parsed.value);
      if (!textCheck.safe) {
        return NextResponse.json(
          { error: "That catchphrase isn't allowed. Keep it friendly and kid-safe." },
          { status: 400 },
        );
      }
    }
    profilePatch.catchphrase = parsed.value;
  }

  const avatarDataUrl =
    typeof body.avatarImageDataUrl === "string" && body.avatarImageDataUrl.startsWith("data:")
      ? body.avatarImageDataUrl
      : null;

  // Action priority for personal avatar: explicit gallery pick > upload > clear.
  // The pool is our own curated set, so it skips Vision moderation but must
  // pass the allowlist check to prevent arbitrary URL injection.
  if (body.pickDefaultAvatar !== undefined) {
    if (typeof body.pickDefaultAvatar !== "string" ||
        !DEFAULT_AVATAR_ALLOWLIST.has(body.pickDefaultAvatar)) {
      return NextResponse.json(
        { error: "That axolotl isn't in our gallery." },
        { status: 400 },
      );
    }
    profilePatch.avatar_url = body.pickDefaultAvatar;
    authPatch.avatar_url = body.pickDefaultAvatar;
    await removeProfileAvatarFromStorage(profile.id);
    awardAvatarCustom = true;
  } else if (avatarDataUrl) {
    const validation = await validateAndModerateAvatar(avatarDataUrl, "Profile photo");
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    try {
      const publicUrl = await uploadProfileAvatar(profile.id, avatarDataUrl);
      profilePatch.avatar_url = publicUrl;
      authPatch.avatar_url = publicUrl;
      awardAvatarCustom = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Avatar upload failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } else if (body.clearAvatar === true) {
    profilePatch.avatar_url = null;
    authPatch.avatar_url = null;
    await removeProfileAvatarFromStorage(profile.id);
  }

  const storefrontAvatarDataUrl =
    typeof body.storefrontAvatarImageDataUrl === "string" &&
    body.storefrontAvatarImageDataUrl.startsWith("data:")
      ? body.storefrontAvatarImageDataUrl
      : null;

  if (body.pickDefaultStorefrontAvatar !== undefined) {
    if (typeof body.pickDefaultStorefrontAvatar !== "string" ||
        !DEFAULT_AVATAR_ALLOWLIST.has(body.pickDefaultStorefrontAvatar)) {
      return NextResponse.json(
        { error: "That axolotl isn't in our gallery." },
        { status: 400 },
      );
    }
    profilePatch.storefront_avatar_url = body.pickDefaultStorefrontAvatar;
    await removeStorefrontProfileAvatarFromStorage(profile.id);
    awardStorefrontAvatar = true;
  } else if (storefrontAvatarDataUrl) {
    const validation = await validateAndModerateAvatar(
      storefrontAvatarDataUrl,
      "Storefront photo",
    );
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    try {
      const publicUrl = await uploadStorefrontProfileAvatar(
        profile.id,
        storefrontAvatarDataUrl,
      );
      profilePatch.storefront_avatar_url = publicUrl;
      awardStorefrontAvatar = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Storefront photo upload failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } else if (body.clearStorefrontAvatar === true) {
    profilePatch.storefront_avatar_url = null;
    await removeStorefrontProfileAvatarFromStorage(profile.id);
  }

  const storefrontBannerDataUrl =
    typeof body.storefrontBannerImageDataUrl === "string" &&
    body.storefrontBannerImageDataUrl.startsWith("data:")
      ? body.storefrontBannerImageDataUrl
      : null;

  if (storefrontBannerDataUrl) {
    const validation = await validateAndModerateBanner(storefrontBannerDataUrl);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    try {
      const publicUrl = await uploadStorefrontBannerImage(
        profile.id,
        storefrontBannerDataUrl,
      );
      profilePatch.storefront_banner_url = publicUrl;
      awardStorefrontBanner = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Storefront banner upload failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } else if (body.clearStorefrontBanner === true) {
    profilePatch.storefront_banner_url = null;
    await removeStorefrontBannerFromStorage(profile.id);
  }

  if (Object.keys(profilePatch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if (Object.keys(authPatch).length > 0) {
    const { error: authError } = await supabase.auth.updateUser({ data: authPatch });
    if (authError) {
      console.error("[account/profile] updateUser error:", authError);
      return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
    }
  }

  if (displayName) {
    const { error: parentError } = await updateParentDisplayName(supabase, user.id, displayName);
    if (parentError) {
      console.error("[account/profile] parent update error:", parentError);
      return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
    }
  }

  const { data: updated, error: profileError } = await updateProfileById(
    supabase,
    profile.id,
    profilePatch,
  );
  if (profileError) {
    console.error("[account/profile] profile update error:", profileError);
    return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
  }

  // ── XP awards, post-save ─────────────────────────────────────────
  // PROFILE_COMPLETE requires the *current* row state (display name +
  // catchphrase + an avatar). Pull from the freshly-updated row so a
  // single save that adds the last missing field still trips the rule.
  const finalName = updated?.display_name ?? displayName ?? profile.display_name;
  const finalCatchphrase = updated?.catchphrase ?? profile.catchphrase ?? null;
  const finalAvatar = updated?.avatar_url ?? profile.avatar_url ?? null;
  const profileComplete =
    Boolean(finalName?.trim()) &&
    Boolean(finalCatchphrase?.trim()) &&
    Boolean(finalAvatar?.trim());

  const xpResults: XpAwardResult[] = [];
  if (awardAvatarCustom) {
    xpResults.push(
      await awardXp({ profileId: profile.id, ruleKey: "AVATAR_CUSTOM" }),
    );
  }
  if (awardStorefrontAvatar) {
    xpResults.push(
      await awardXp({ profileId: profile.id, ruleKey: "STOREFRONT_AVATAR" }),
    );
  }
  if (awardStorefrontBanner) {
    xpResults.push(
      await awardXp({
        profileId: profile.id,
        ruleKey: "STOREFRONT_BANNER_UPLOAD",
      }),
    );
  }
  if (profileComplete) {
    xpResults.push(
      await awardXp({ profileId: profile.id, ruleKey: "PROFILE_COMPLETE" }),
    );
  }

  return NextResponse.json({
    displayName: finalName,
    catchphrase: finalCatchphrase,
    avatarUrl: finalAvatar,
    storefrontAvatarUrl:
      updated?.storefront_avatar_url ?? profile.storefront_avatar_url ?? null,
    storefrontBannerUrl:
      updated?.storefront_banner_url ?? profile.storefront_banner_url ?? null,
    xpAwards: pickXpToastPayload(xpResults),
  });
}
