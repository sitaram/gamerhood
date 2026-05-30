import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultProfileForAuthUser,
  getStorefrontById,
} from "@/lib/supabase/queries";
import { getListingDefaultsForStorefront } from "@/lib/storefront/listing-defaults";

export const dynamic = "force-dynamic";

/**
 * GET /api/storefronts/[id]/listing-defaults
 *
 * Returns the values that the /create publish form should pre-fill for
 * the chosen storefront. Always returns 200 with the resolver's reply —
 * an empty `{ source: "none", … }` payload is the right answer for
 * brand-new sellers (the UI shows no badge and leaves the inputs
 * blank).
 *
 * Auth-gated to the storefront's owner so we never leak another
 * creator's draft description / tags before they've published.
 */
export async function GET(
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

  const storefront = await getStorefrontById(supabase, id);
  if (!storefront) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (storefront.owner_profile_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const defaults = await getListingDefaultsForStorefront(supabase, storefront.id);
  return NextResponse.json({ defaults });
}
