import { isPrintfulConfigured } from "@/lib/printful/client";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  generateFlatBlankMockup,
  getOrGenerateBlankForVariantId,
  getOrGenerateFlatBlankMockup,
  listColorVariantsForCatalogProduct,
} from "@/lib/printful/blank-mockup";
import { getCatalogConfig } from "@/lib/printful/catalog";
import type { ProductType } from "@/lib/types";

/**
 * Resolves the flat blank product photo URL for a ProductType (legacy) or
 * a specific (ProductType, color) pair (post-030).
 *
 * Cache hierarchy:
 *   1. `printful_blank_mockups` DB table — keyed by `catalog_variant_id`.
 *   2. Process-warm memo so hot paths (`/api/printful/blank-photo`) don't
 *      hit Supabase on every poll while a background job is in flight.
 *
 * Generation is intentionally async — the GET endpoint returns
 * `{ url: null, status: "generating" }` on cache miss and kicks off a
 * background job, so the client falls back to the SVG silhouette while the
 * job completes (then a re-fetch on the next mount picks up the URL).
 */

export type BlankPhotoStatus = "ready" | "generating" | "unavailable";

export interface BlankPhotoResult {
  url: string | null;
  status: BlankPhotoStatus;
  /**
   * Real Printful print area in inches for this variant's configured
   * placement, when cached. `null` while generating or if Printful didn't
   * report dims (some embroidery SKUs omit them). Client falls back to
   * `DEFAULT_PRINT_AREA_IN` from catalog.ts.
   */
  printArea: { width: number; height: number } | null;
}

interface MemoEntry {
  result: BlankPhotoResult;
  /** Set while a background mockup-tasks job is in flight. */
  pending?: Promise<BlankPhotoResult>;
}

/**
 * Memo keys are either `productType` (legacy default-color path) or
 * `productType::color` (post-030 per-color path) so the two callers don't
 * collide on the same cache slot.
 */
const memo = new Map<string, MemoEntry>();

export function clearBlankPhotoCache(): void {
  memo.clear();
}

function memoKey(productType: ProductType, colorName?: string | null): string {
  return colorName ? `${productType}::${colorName.toLowerCase()}` : productType;
}

/**
 * Read a cached blank from the DB by the most-specific key available:
 *   - `(product_type, color_name)` when color is provided
 *   - `catalog_variant_id == env-default` otherwise
 *
 * Returns null when no row exists; callers decide whether to kick off
 * generation.
 */
async function readCachedBlank(
  productType: ProductType,
  colorName?: string | null,
): Promise<BlankPhotoResult | null> {
  try {
    const supabase = getServiceClient();
    let query = supabase
      .from("printful_blank_mockups")
      .select("mockup_url, print_area_width_in, print_area_height_in")
      .eq("product_type", productType);
    if (colorName) {
      query = query.ilike("color_name", colorName);
    } else {
      const cfg = getCatalogConfig(productType);
      if (!cfg) {
        console.warn("[blank-mockup] cache read: no catalog config (env unset)", { productType });
        return null;
      }
      query = query.eq("catalog_variant_id", cfg.catalogVariantId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.warn("[blank-mockup] DB cache read error", {
        productType,
        colorName,
        error: error.message,
      });
      return null;
    }
    if (!data) {
      console.warn("[blank-mockup] DB cache miss", { productType, colorName });
      return null;
    }
    const url = data?.mockup_url;
    if (typeof url !== "string" || !url) {
      console.warn("[blank-mockup] DB cache row exists but mockup_url is empty", {
        productType,
        colorName,
      });
      return null;
    }
    const w = data?.print_area_width_in;
    const h = data?.print_area_height_in;
    const printArea =
      typeof w === "number" && typeof h === "number" && w > 0 && h > 0
        ? { width: w, height: h }
        : null;
    console.log("[blank-mockup] DB cache hit", { productType, colorName, url, printArea });
    return { url, status: "ready", printArea };
  } catch (err) {
    console.warn("[blank-mockup] DB cache read threw", {
      productType,
      colorName,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Resolve the catalog_variant_id for a (productType, colorName) pair.
 * Pages catalog-products/{id}/catalog-variants once and matches the color
 * (case-insensitive). Returns null when colorName has no matching variant
 * or env config is missing.
 */
async function resolveVariantForColor(
  productType: ProductType,
  colorName: string,
): Promise<{ variantId: number; colorHex: string | null } | null> {
  const cfg = getCatalogConfig(productType);
  if (!cfg) return null;
  /**
   * Cheapest path: hit catalog-variants/{default} for its product id, then
   * page through siblings for the color match. Implemented in
   * `listColorVariantsForCatalogProduct` so warming and view-time both use
   * the same code path (and identical dedup semantics).
   */
  // We need the catalog_product_id. Pull it from the cached default row
  // first to avoid one network round-trip.
  let catalogProductId: number | null = null;
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("printful_blank_mockups")
      .select("catalog_product_id")
      .eq("catalog_variant_id", cfg.catalogVariantId)
      .maybeSingle();
    catalogProductId =
      typeof data?.catalog_product_id === "number" ? data.catalog_product_id : null;
  } catch {
    // service-role unavailable — fall through to Printful lookup below
  }
  if (!catalogProductId) {
    /**
     * Fallback: ask Printful directly. This adds one round-trip but only
     * happens on first warm of a brand-new product type; afterwards the
     * default row above carries the id.
     */
    try {
      const { printfulRequest } = await import("@/lib/printful/client");
      const res = await printfulRequest<{ data?: { catalog_product_id?: number } }>(
        `/catalog-variants/${cfg.catalogVariantId}`,
      );
      const id = res.data?.catalog_product_id;
      catalogProductId = typeof id === "number" ? id : null;
    } catch (err) {
      console.warn("[blank-mockup] resolveVariantForColor: catalog product fetch failed", {
        productType,
        colorName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  if (!catalogProductId) return null;

  const variants = await listColorVariantsForCatalogProduct(catalogProductId);
  const norm = colorName.trim().toLowerCase();
  const match = variants.find((v) => v.colorName.trim().toLowerCase() === norm);
  if (!match) {
    console.warn("[blank-mockup] resolveVariantForColor: no color match", {
      productType,
      colorName,
      catalogProductId,
      sampleColors: variants.slice(0, 6).map((v) => v.colorName),
    });
    return null;
  }
  return { variantId: match.variantId, colorHex: match.colorHex };
}

/**
 * Kick off (or join) a background generation job for a (productType, color)
 * cell. Per-color jobs run Track A (fast catalog photo); the legacy default
 * path stays on `generateFlatBlankMockup` for compatibility with the
 * placement editor's mockup-task framing.
 */
function startBackgroundGeneration(
  productType: ProductType,
  colorName?: string | null,
): Promise<BlankPhotoResult> {
  const key = memoKey(productType, colorName);
  const existing = memo.get(key);
  if (existing?.pending) {
    console.log("[blank-mockup] joining existing in-flight generation", {
      productType,
      colorName,
    });
    return existing.pending;
  }
  console.warn("[blank-mockup] starting background generation", { productType, colorName });

  const p = (async (): Promise<BlankPhotoResult> => {
    if (colorName) {
      const resolved = await resolveVariantForColor(productType, colorName);
      if (!resolved) {
        const result: BlankPhotoResult = { url: null, status: "unavailable", printArea: null };
        memo.set(key, { result });
        return result;
      }
      const row = await getOrGenerateBlankForVariantId(resolved.variantId, productType, {
        colorName,
        colorHex: resolved.colorHex,
      }).catch((err) => {
        console.warn("[blank-mockup] per-color generation threw", {
          productType,
          colorName,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      });
      if (!row?.mockup_url) {
        const result: BlankPhotoResult = { url: null, status: "unavailable", printArea: null };
        memo.set(key, { result });
        return result;
      }
      const result: BlankPhotoResult = {
        url: row.mockup_url,
        status: "ready",
        printArea: extractRowPrintArea(row),
      };
      memo.set(key, { result });
      return result;
    }

    /** Legacy default-color path keeps the existing mockup-tasks behavior. */
    const generated = await generateFlatBlankMockup(productType).catch((err) => {
      console.warn("[blank-mockup] background generation threw", {
        productType,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    });
    if (!generated) {
      const result: BlankPhotoResult = { url: null, status: "unavailable", printArea: null };
      memo.set(key, { result });
      return result;
    }
    const row = await getOrGenerateFlatBlankMockup(productType).catch((err) => {
      console.warn("[blank-mockup] persisting to DB cache threw", {
        productType,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    });
    const result: BlankPhotoResult = {
      url: row?.mockup_url ?? generated.url,
      status: "ready",
      printArea: extractRowPrintArea(row) ?? generated.printArea,
    };
    memo.set(key, { result });
    return result;
  })();

  memo.set(key, {
    result: { url: null, status: "generating", printArea: null },
    pending: p,
  });

  return p;
}

function extractRowPrintArea(
  row: { print_area_width_in: number | null; print_area_height_in: number | null } | null,
): { width: number; height: number } | null {
  const w = row?.print_area_width_in;
  const h = row?.print_area_height_in;
  if (typeof w === "number" && typeof h === "number" && w > 0 && h > 0) {
    return { width: w, height: h };
  }
  return null;
}

/**
 * Quick non-blocking resolution: returns `ready` if cached, `generating`
 * (and starts a background job) if not, or `unavailable` if Printful isn't
 * configured. Never blocks longer than a single Supabase round-trip.
 *
 * `colorName` is optional; when set we resolve the variant for that color
 * and look up its per-color blank. Otherwise we fall back to the legacy
 * default-variant lookup (used by the placement editor + product card).
 */
export async function getBlankPhotoForProductType(
  productType: ProductType,
  colorName?: string | null,
): Promise<BlankPhotoResult> {
  console.log("[blank-mockup] resolve start", { productType, colorName });
  const key = memoKey(productType, colorName);

  const memoEntry = memo.get(key);
  if (memoEntry && memoEntry.result.status === "ready") {
    console.log("[blank-mockup] process memo hit (ready)", {
      productType,
      colorName,
      url: memoEntry.result.url,
    });
    return memoEntry.result;
  }

  if (!isPrintfulConfigured()) {
    console.warn("[blank-mockup] PRINTFUL_API_TOKEN not set — returning unavailable", {
      productType,
    });
    const result: BlankPhotoResult = { url: null, status: "unavailable", printArea: null };
    memo.set(key, { result });
    return result;
  }

  const cached = await readCachedBlank(productType, colorName);
  if (cached) {
    memo.set(key, { result: cached });
    return cached;
  }

  if (memoEntry?.pending) {
    console.log("[blank-mockup] generation already in flight — returning generating", {
      productType,
      colorName,
    });
    return { url: null, status: "generating", printArea: null };
  }

  /** Fire-and-await-elsewhere: do NOT await `p`, return generating status now. */
  void startBackgroundGeneration(productType, colorName);
  console.log("[blank-mockup] kicked off background generation — returning generating", {
    productType,
    colorName,
  });
  return { url: null, status: "generating", printArea: null };
}
