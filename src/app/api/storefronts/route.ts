import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  getDefaultProfileForAuthUser,
  isStorefrontSlugTaken,
  listStorefrontsByOwner,
} from "@/lib/supabase/queries";
import { validateStoreSlug } from "@/lib/slug-utils";
import { moderateText } from "@/lib/moderation";

export const dynamic = "force-dynamic";

const MAX_DISPLAY_NAME_LEN = 80;
const MAX_CATCHPHRASE_LEN = 120;

/**
 * GET — list the signed-in user's storefronts. Returns them sorted with
 * the default storefront first, then by creation order so the settings UI
 * shows them in a stable arrangement.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ storefronts: [] });
  }

  const storefronts = await listStorefrontsByOwner(supabase, profile.id);
  return NextResponse.json({ storefronts });
}

/**
 * POST — create a new storefront for the signed-in user. The first
 * storefront a user creates becomes their default; subsequent ones
 * default to `is_default = false` until the user promotes them via
 * `/api/storefronts/[id]/set-default`.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (!profile) {
    return NextResponse.json(
      {
        error:
          "Set up your creator profile first — head to Dashboard → Settings.",
      },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slugV = validateStoreSlug(typeof body.slug === "string" ? body.slug : "");
  if (!slugV.ok) {
    return NextResponse.json({ error: slugV.error }, { status: 400 });
  }

  if (typeof body.displayName !== "string" || !body.displayName.trim()) {
    return NextResponse.json(
      { error: "Display name is required." },
      { status: 400 },
    );
  }
  const displayName = body.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN);

  let catchphrase: string | null = null;
  if (typeof body.catchphrase === "string" && body.catchphrase.trim()) {
    catchphrase = body.catchphrase.trim().slice(0, MAX_CATCHPHRASE_LEN);
    const safety = await moderateText(catchphrase);
    if (!safety.safe) {
      return NextResponse.json(
        {
          error:
            "That catchphrase isn't allowed. Keep it friendly and kid-safe.",
        },
        { status: 400 },
      );
    }
  }

  const avatarUrl = sanitizeUrlInput(body.avatarUrl);
  const bannerUrl = sanitizeUrlInput(body.bannerUrl);
  const heroImageUrl = sanitizeUrlInput(body.heroImageUrl);

  if (await isStorefrontSlugTaken(supabase, slugV.slug)) {
    return NextResponse.json(
      { error: "That shop URL is already taken." },
      { status: 409 },
    );
  }

  const existing = await listStorefrontsByOwner(supabase, profile.id);
  const isDefault = existing.length === 0;

  // Use the service client when available so we can write through
  // unambiguously even on requests where the SSR cookie auth hasn't
  // hydrated yet (e.g. immediately after sign-up).
  let writer = supabase;
  try {
    writer = getServiceClient();
  } catch {
    // fall back to the user-scoped client; RLS will allow the insert.
  }

  const { data: created, error } = await writer
    .from("storefronts")
    .insert({
      owner_profile_id: profile.id,
      slug: slugV.slug,
      display_name: displayName,
      catchphrase,
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
      hero_image_url: heroImageUrl,
      is_default: isDefault,
    })
    .select()
    .single();

  if (error || !created) {
    console.error("[storefronts POST]", error);
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "That shop URL is already taken." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Could not create storefront" },
      { status: 500 },
    );
  }

  return NextResponse.json({ storefront: created });
}

function sanitizeUrlInput(raw: unknown): string | null {
  if (raw === null) return null;
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) return null;
  return v.slice(0, 2000);
}
