import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { getDefaultProfileForAuthUser } from "@/lib/supabase/queries";
import { augmentMerchFromPrintfulCatalog } from "@/lib/printful/catalog-meta";
import { refreshPrintfulListingMockupForProduct } from "@/lib/printful/mockups";
import { isPrintfulConfigured } from "@/lib/printful/client";
import type { ProductType } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Re-fetch Printful catalog description, color list, sizes, and size-guide tables
 * for an existing product (owner only). Use after changing env variant or to backfill.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: productId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPrintfulConfigured()) {
    return NextResponse.json(
      { error: "Printful is not configured (PRINTFUL_API_TOKEN)." },
      { status: 503 },
    );
  }

  const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("products")
    .select("id, profile_id, product_type, printful_catalog_variant_id, sizes")
    .eq("id", productId)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (row.profile_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const variantId = row.printful_catalog_variant_id;
  if (!variantId) {
    return NextResponse.json(
      { error: "This product has no printful_catalog_variant_id to look up." },
      { status: 400 },
    );
  }

  const productType = row.product_type as ProductType;
  const aug = await augmentMerchFromPrintfulCatalog(variantId, productType);
  if (!aug?.meta) {
    return NextResponse.json(
      { error: "Could not load catalog data from Printful for this variant." },
      { status: 502 },
    );
  }

  const patch: Record<string, unknown> = {
    printful_catalog_product_id: aug.catalogProductId,
    printful_catalog_meta: aug.meta,
  };
  if (aug.colors?.length) patch.colors = aug.colors;
  if (aug.sizes !== null && aug.sizes.length > 0) patch.sizes = aug.sizes;

  const { data: updated, error: upErr } = await supabase
    .from("products")
    .update(patch)
    .eq("id", productId)
    .select()
    .single();

  if (upErr) {
    console.error("[refresh-printful]", upErr);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // Backfill the real (re-hosted) Printful mockup so existing listings show
  // the accurate preview==print render. Idempotent: skips rows that already
  // have a re-hosted mockup. Best-effort — never fails the metadata refresh.
  let mockupUrl: string | null = null;
  try {
    mockupUrl = await refreshPrintfulListingMockupForProduct(getServiceClient(), productId);
  } catch (err) {
    console.warn("[refresh-printful] mockup refresh skipped:", err);
  }

  return NextResponse.json({ product: updated, mockupUrl });
}
