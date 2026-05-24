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
} from "@/lib/storage";
import { moderateImageBase64, moderateText } from "@/lib/moderation";

export const dynamic = "force-dynamic";

const MAX_DISPLAY_NAME_LEN = 80;
const MAX_CATCHPHRASE_LEN = 120;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
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
 * uploaders — same kid-safety rules apply to both photos.
 */
async function validateAndModerateAvatar(
  dataUrl: string,
  label: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const mimeMatch = dataUrl.match(/^data:([^;,]+)/i);
  const mime = mimeMatch?.[1]?.split(";")[0].trim().toLowerCase() ?? "";
  if (!ALLOWED_AVATAR_MIME.test(mime)) {
    return { ok: false, error: `${label} must be PNG, JPG, or WebP.` };
  }
  const bytes = estimateDataUrlBytes(dataUrl);
  if (bytes !== null && bytes > MAX_AVATAR_BYTES) {
    return { ok: false, error: `${label} must be 2 MB or smaller.` };
  }
  const moderation = await moderateImageBase64(dataUrl);
  if (!moderation.safe) {
    return {
      ok: false,
      error: "That photo didn't pass our safety check. Try a different image.",
    };
  }
  return { ok: true };
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

  if (body.clearAvatar === true) {
    profilePatch.avatar_url = null;
    authPatch.avatar_url = null;
    await removeProfileAvatarFromStorage(profile.id);
  } else if (avatarDataUrl) {
    const validation = await validateAndModerateAvatar(avatarDataUrl, "Profile photo");
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    try {
      const publicUrl = await uploadProfileAvatar(profile.id, avatarDataUrl);
      profilePatch.avatar_url = publicUrl;
      authPatch.avatar_url = publicUrl;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Avatar upload failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const storefrontAvatarDataUrl =
    typeof body.storefrontAvatarImageDataUrl === "string" &&
    body.storefrontAvatarImageDataUrl.startsWith("data:")
      ? body.storefrontAvatarImageDataUrl
      : null;

  if (body.clearStorefrontAvatar === true) {
    profilePatch.storefront_avatar_url = null;
    await removeStorefrontProfileAvatarFromStorage(profile.id);
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Storefront photo upload failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
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

  return NextResponse.json({
    displayName: updated?.display_name ?? displayName ?? profile.display_name,
    catchphrase: updated?.catchphrase ?? profile.catchphrase ?? null,
    avatarUrl: updated?.avatar_url ?? profile.avatar_url ?? null,
    storefrontAvatarUrl:
      updated?.storefront_avatar_url ?? profile.storefront_avatar_url ?? null,
  });
}
