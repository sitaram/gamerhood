import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  countProductsByStorefront,
  getDefaultProfileForAuthUser,
  getStorefrontById,
  isStorefrontSlugTaken,
  updateProfileById,
} from "@/lib/supabase/queries";
import { validateStoreSlug } from "@/lib/slug-utils";
import { moderateText } from "@/lib/moderation";

export const dynamic = "force-dynamic";

const MAX_DISPLAY_NAME_LEN = 80;
const MAX_CATCHPHRASE_LEN = 120;

/**
 * PATCH /api/storefronts/[id]
 * Update one storefront the signed-in user owns. Slug + content fields
 * only — toggling default lives on `/set-default` so we can flip the
 * old default atomically.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "No creator profile" }, { status: 400 });
  }

  const existing = await getStorefrontById(supabase, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.owner_profile_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.slug === "string") {
    const slugV = validateStoreSlug(body.slug);
    if (!slugV.ok) {
      return NextResponse.json({ error: slugV.error }, { status: 400 });
    }
    if (slugV.slug !== existing.slug) {
      if (await isStorefrontSlugTaken(supabase, slugV.slug, existing.id)) {
        return NextResponse.json(
          { error: "That shop URL is already taken." },
          { status: 409 },
        );
      }
      patch.slug = slugV.slug;
    }
  }

  if (typeof body.displayName === "string") {
    const name = body.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN);
    if (!name) {
      return NextResponse.json(
        { error: "Display name cannot be empty." },
        { status: 400 },
      );
    }
    patch.display_name = name;
  }

  if (body.catchphrase === null) {
    patch.catchphrase = null;
  } else if (typeof body.catchphrase === "string") {
    const cp = body.catchphrase.trim().slice(0, MAX_CATCHPHRASE_LEN);
    if (cp) {
      const safety = await moderateText(cp);
      if (!safety.safe) {
        return NextResponse.json(
          {
            error:
              "That catchphrase isn't allowed. Keep it friendly and kid-safe.",
          },
          { status: 400 },
        );
      }
      patch.catchphrase = cp;
    } else {
      patch.catchphrase = null;
    }
  }

  for (const [bodyKey, dbKey] of [
    ["avatarUrl", "avatar_url"],
    ["bannerUrl", "banner_url"],
    ["heroImageUrl", "hero_image_url"],
  ] as const) {
    if (body[bodyKey] === null) {
      patch[dbKey] = null;
    } else if (typeof body[bodyKey] === "string") {
      const v = (body[bodyKey] as string).trim();
      if (!v) {
        patch[dbKey] = null;
      } else if (/^https?:\/\//i.test(v)) {
        patch[dbKey] = v.slice(0, 2000);
      } else {
        return NextResponse.json(
          { error: `${bodyKey} must be an http(s) URL.` },
          { status: 400 },
        );
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();

  let writer = supabase;
  try {
    writer = getServiceClient();
  } catch {
    // fall back to RLS-scoped client
  }

  const { data: updated, error } = await writer
    .from("storefronts")
    .update(patch)
    .eq("id", existing.id)
    .eq("owner_profile_id", profile.id)
    .select()
    .single();

  if (error || !updated) {
    console.error("[storefronts PATCH]", error);
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "That shop URL is already taken." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not update storefront" },
      { status: 500 },
    );
  }

  // Read-after-write parity with the profile row while legacy readers
  // (StorefrontSettingsForm, /shop/[slug] metadata fallbacks) still pull
  // storefront fields off the profile. We only mirror when editing the
  // user's default storefront — non-default storefronts don't represent
  // the user's "main" shop, so the profile keeps showing the default.
  // See LAUNCH_CHECKLIST.md for the deprecation plan.
  if (existing.is_default) {
    const mirror: Parameters<typeof updateProfileById>[2] = {};
    if (typeof patch.slug === "string") mirror.slug = patch.slug as string;
    if (typeof patch.display_name === "string")
      mirror.display_name = patch.display_name as string;
    if (patch.catchphrase === null || typeof patch.catchphrase === "string")
      mirror.catchphrase = patch.catchphrase as string | null;
    if (patch.avatar_url === null || typeof patch.avatar_url === "string")
      mirror.storefront_avatar_url = patch.avatar_url as string | null;
    if (patch.banner_url === null || typeof patch.banner_url === "string")
      mirror.storefront_banner_url = patch.banner_url as string | null;
    if (
      patch.hero_image_url === null ||
      typeof patch.hero_image_url === "string"
    )
      mirror.storefront_hero_image_url = patch.hero_image_url as string | null;

    if (Object.keys(mirror).length > 0) {
      await updateProfileById(writer, profile.id, mirror).catch((err) =>
        console.warn("[storefronts PATCH] profile mirror failed:", err),
      );
    }
  }

  return NextResponse.json({ storefront: updated });
}

/**
 * DELETE /api/storefronts/[id]
 * Block deletion when the storefront has any products (creator must
 * move or unpublish them first), or when it's currently the user's
 * default (they must promote a sibling before deleting).
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "No creator profile" }, { status: 400 });
  }

  const existing = await getStorefrontById(supabase, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.owner_profile_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (existing.is_default) {
    return NextResponse.json(
      {
        error:
          "Set another storefront as default first — your default can't be deleted.",
        code: "IS_DEFAULT",
      },
      { status: 409 },
    );
  }

  const productCount = await countProductsByStorefront(supabase, existing.id);
  if (productCount > 0) {
    return NextResponse.json(
      {
        error:
          "Move or unpublish products on this storefront before deleting it.",
        code: "HAS_PRODUCTS",
        productCount,
      },
      { status: 409 },
    );
  }

  let writer = supabase;
  try {
    writer = getServiceClient();
  } catch {
    // fall back to RLS-scoped client
  }

  const { error } = await writer
    .from("storefronts")
    .delete()
    .eq("id", existing.id)
    .eq("owner_profile_id", profile.id);

  if (error) {
    console.error("[storefronts DELETE]", error);
    return NextResponse.json(
      { error: "Could not delete storefront" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
