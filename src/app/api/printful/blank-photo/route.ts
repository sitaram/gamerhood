import { NextRequest, NextResponse } from "next/server";
import { getBlankPhotoForProductType } from "@/lib/printful/blank-photo";
import type { ProductType } from "@/lib/types";

export const dynamic = "force-dynamic";

const KNOWN_TYPES = new Set<ProductType>([
  "hoodie",
  "kids-hoodie",
  "kids-heavyweight-tee",
  "kids-long-sleeve",
  "kids-sports-tee",
  "kids-tshirt",
  "tshirt",
  "joggers",
  "mug",
  "poster",
  "backpack",
  "phone-case",
  "sticker",
  "pillow",
  "blanket",
  "pet-sweater",
  "tote-bag",
  "ornament",
  "puzzle",
  "embroidered-patch",
  "hardcover-journal",
]);

/**
 * Returns `{ url, status, printArea }` for the flat blank product mockup of a given product type.
 *   - status="ready"        — `url` is a Printful CDN URL safe to use as a backdrop
 *   - status="generating"   — first-time generation in flight (client should re-poll)
 *   - status="unavailable"  — Printful not configured or catalog mapping missing
 *   - printArea             — `{ width, height }` in inches from Printful's
 *                             `placement_dimensions` (when cached); falls back
 *                             to hardcoded DEFAULT_PRINT_AREA_IN on the client.
 *
 * Mockups + print area dims are cached in `printful_blank_mockups` (DB) plus
 * an in-process memo. Generation takes ~10–30 s for a cold SKU; the route
 * returns "generating" immediately and finishes the job in the background.
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  console.log("[blank-mockup-api] received", { productType: type });

  if (!type || !KNOWN_TYPES.has(type as ProductType)) {
    console.warn("[blank-mockup-api] rejected unknown product type", { productType: type });
    return NextResponse.json({ error: "Unknown product type" }, { status: 400 });
  }

  const result = await getBlankPhotoForProductType(type as ProductType);
  console.log("[blank-mockup-api] responded", {
    productType: type,
    status: result.status,
    hasUrl: Boolean(result.url),
    url: result.url,
    printArea: result.printArea,
  });
  /** Short cache only when ready — `generating` must re-poll. */
  const cacheControl =
    result.status === "ready" ? "public, max-age=600, s-maxage=3600" : "no-store";
  return NextResponse.json(result, {
    headers: { "Cache-Control": cacheControl },
  });
}
