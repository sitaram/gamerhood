import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  updateProfileById,
  isProfileSlugTaken,
} from "@/lib/supabase/queries";
import { uploadStorefrontHeroImage } from "@/lib/storage";
import { validateStoreSlug } from "@/lib/slug-utils";
import { awardXp, pickXpToastPayload } from "@/lib/xp/award";

export const dynamic = "force-dynamic";

const OVERLAYS = new Set(["none", "dark", "light", "gradient"]);

function normalizeTags(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const t = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 24) break;
  }
  return out;
}

/**
 * PATCH — update signed-in creator's shop URL, homepage hero, and store SEO.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profErr } = await getDefaultProfileForAuthUser(
    supabase,
    user.id,
  );
  if (profErr || !profile) {
    return NextResponse.json({ error: "No creator profile" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateProfileById>[2] = {};

  if (typeof body.slug === "string") {
    const v = validateStoreSlug(body.slug);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }
    const taken = await isProfileSlugTaken(supabase, v.slug, profile.id);
    if (taken) {
      return NextResponse.json({ error: "That shop URL is already taken." }, { status: 409 });
    }
    patch.slug = v.slug;
  }

  if (typeof body.bio === "string") {
    patch.bio = body.bio.slice(0, 2000);
  }

  if (body.storefrontHeadline === null) {
    patch.storefront_headline = null;
  } else if (typeof body.storefrontHeadline === "string") {
    patch.storefront_headline = body.storefrontHeadline.slice(0, 200) || null;
  }

  if (body.storefrontSubhead === null) {
    patch.storefront_subhead = null;
  } else if (typeof body.storefrontSubhead === "string") {
    patch.storefront_subhead = body.storefrontSubhead.slice(0, 500) || null;
  }

  if (typeof body.storefrontHeroOverlay === "string" && OVERLAYS.has(body.storefrontHeroOverlay)) {
    patch.storefront_hero_overlay = body.storefrontHeroOverlay;
  }

  if (body.storeSeoTitle === null) {
    patch.store_seo_title = null;
  } else if (typeof body.storeSeoTitle === "string") {
    patch.store_seo_title = body.storeSeoTitle.slice(0, 70) || null;
  }

  if (body.storeSeoDescription === null) {
    patch.store_seo_description = null;
  } else if (typeof body.storeSeoDescription === "string") {
    patch.store_seo_description = body.storeSeoDescription.slice(0, 320) || null;
  }

  const tagList = normalizeTags(body.storeTags);
  if (tagList !== undefined) {
    patch.store_tags = tagList;
  }

  const heroDataUrl =
    typeof body.heroImageDataUrl === "string" && body.heroImageDataUrl.startsWith("data:")
      ? body.heroImageDataUrl
      : null;

  if (body.clearHeroImage === true) {
    patch.storefront_hero_image_url = null;
  } else if (heroDataUrl) {
    try {
      patch.storefront_hero_image_url = await uploadStorefrontHeroImage(profile.id, heroDataUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Hero upload failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: updated, error } = await updateProfileById(supabase, profile.id, patch);
  if (error) {
    console.error("[storefront/settings]", error);
    return NextResponse.json({ error: "Could not save settings" }, { status: 500 });
  }

  // STOREFRONT_CREATED — first successful save to /api/storefront/settings
  // is our heuristic for "they configured their shop". One-shot via the
  // unique index on (profile_id, rule_key), so re-saves are no-ops.
  const created = await awardXp({
    profileId: profile.id,
    ruleKey: "STOREFRONT_CREATED",
    metadata: { fields: Object.keys(patch) },
  });

  return NextResponse.json({
    profile: updated,
    xpAwards: pickXpToastPayload([created]),
  });
}
