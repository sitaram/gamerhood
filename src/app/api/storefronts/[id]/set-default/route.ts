import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  getDefaultProfileForAuthUser,
  getStorefrontById,
  updateProfileById,
} from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

/**
 * POST /api/storefronts/[id]/set-default
 *
 * Promote a storefront to be the user's default. The DB has a partial
 * unique index `storefronts_one_default_per_owner` so the flip has to
 * happen as two writes — the old default off first, then the new one
 * on. We do both with the service-role client so a transient RLS
 * mismatch can't leave the user with two defaults.
 *
 * Also mirrors the new default's storefront-facing fields onto the
 * owner's `profiles` row so legacy readers (`/shop/[slug]` metadata
 * fallbacks, `StorefrontSettingsForm`) keep showing the "right"
 * default until those readers migrate to the storefronts table.
 */
export async function POST(
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

  const target = await getStorefrontById(supabase, id);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.owner_profile_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (target.is_default) {
    return NextResponse.json({ ok: true, storefront: target });
  }

  let writer;
  try {
    writer = getServiceClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "Default switching needs server credentials — please try again later.",
      },
      { status: 503 },
    );
  }

  // Two-step flip: drop existing defaults first to satisfy the partial
  // unique index, then promote the new one.
  const { error: clearErr } = await writer
    .from("storefronts")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("owner_profile_id", profile.id)
    .eq("is_default", true);

  if (clearErr) {
    console.error("[storefronts/set-default] clear error", clearErr);
    return NextResponse.json(
      { error: "Could not switch default" },
      { status: 500 },
    );
  }

  const { data: updated, error: setErr } = await writer
    .from("storefronts")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", target.id)
    .eq("owner_profile_id", profile.id)
    .select()
    .single();

  if (setErr || !updated) {
    console.error("[storefronts/set-default] set error", setErr);
    return NextResponse.json(
      { error: "Could not switch default" },
      { status: 500 },
    );
  }

  // Mirror to the profile so legacy readers stay in sync.
  await updateProfileById(writer, profile.id, {
    slug: updated.slug,
    display_name: updated.display_name,
    catchphrase: updated.catchphrase,
    storefront_avatar_url: updated.avatar_url,
    storefront_banner_url: updated.banner_url,
    storefront_hero_image_url: updated.hero_image_url,
  }).catch((err) =>
    console.warn("[storefronts/set-default] profile mirror failed:", err),
  );

  return NextResponse.json({ ok: true, storefront: updated });
}
