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
 * Returns `{ url, status, printArea, printAreaPixelRect }` for the flat
 * blank product mockup of a given product type.
 *   - status="ready"        — `url` is a re-hosted Supabase URL safe to use as a backdrop
 *   - status="generating"   — first-time generation in flight (client should re-poll)
 *   - status="unavailable"  — Printful not configured or catalog mapping missing
 *   - printArea             — `{ width, height }` in inches from Printful's
 *                             `placement_dimensions` (when cached); falls back
 *                             to hardcoded DEFAULT_PRINT_AREA_IN on the client.
 *   - printAreaPixelRect    — `{ mockupWidthPx, mockupHeightPx, xPx, yPx, wPx, hPx }`
 *                             when the v1 mockup-generator template populated
 *                             pixel coords for this variant (migration 033 +
 *                             `fetchVariantPrintAreaPx`). Tells the editor
 *                             exactly where the cyan frame should land on
 *                             the rendered mockup; null = fall back to
 *                             photoBand.
 *
 * Query params:
 *   - `type`   ProductType — required
 *   - `color`  optional color name (e.g. "Heather Sport Dark Navy") — when
 *              set, resolves the variant for that color and serves the
 *              per-color blank photo; cache is keyed by
 *              (product_type, color_name) on the server.
 *
 * Mockups + print area dims are cached in `printful_blank_mockups` (DB) plus
 * an in-process memo. Track A (catalog photo) is ~1 s for a cold variant;
 * Track B (mockup-tasks) is ~10–30 s. The route returns "generating"
 * immediately when it kicks off Track A in the background.
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const colorRaw = request.nextUrl.searchParams.get("color");
  const color = colorRaw && colorRaw.trim() ? colorRaw.trim() : null;
  console.log("[blank-mockup-api] received", { productType: type, color });

  if (!type || !KNOWN_TYPES.has(type as ProductType)) {
    console.warn("[blank-mockup-api] rejected unknown product type", { productType: type });
    return NextResponse.json({ error: "Unknown product type" }, { status: 400 });
  }

  const result = await getBlankPhotoForProductType(type as ProductType, color);
  console.log("[blank-mockup-api] responded", {
    productType: type,
    color,
    status: result.status,
    hasUrl: Boolean(result.url),
    url: result.url,
    printArea: result.printArea,
    hasPixelRect: Boolean(result.printAreaPixelRect),
  });
  /** Short cache only when ready — `generating` must re-poll. */
  const cacheControl =
    result.status === "ready" ? "public, max-age=600, s-maxage=3600" : "no-store";
  return NextResponse.json(result, {
    headers: { "Cache-Control": cacheControl },
  });
}
