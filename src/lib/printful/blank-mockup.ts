/**
 * Flat blank product mockup generator.
 *
 * Why this exists: Printful's `/v2/catalog-variants/{id}.image_url` is often
 * a lifestyle "on model" shot, which makes a terrible backdrop for a
 * placement editor (model body + studio background swamp the actual
 * garment). The mockup-generator API can render the same SKU with a "Flat"
 * mockup style and any design layer, including a transparent dummy — which
 * yields a true flat product photo of the blank itself.
 *
 * Flow:
 *   1. Ensure a 1x1 transparent PNG exists in the public `design-images`
 *      bucket so Printful has a fetchable layer URL.
 *   2. Pick a Flat (or Ghost mannequin) style from `/v2/catalog-products/{id}/mockup-styles`.
 *   3. Submit a `/v2/mockup-tasks` job with that style + the dummy layer
 *      sized to the full print area (so the layer is "centered" but invisible).
 *   4. Poll until the task completes and persist the URL in
 *      `printful_blank_mockups` keyed by ProductType.
 *
 * Subsequent calls hit the DB cache (process-warm cache wraps that). Mockup
 * URLs Printful returns live on their CDN and don't expire; we just refresh
 * if the user runs the `scripts/printful-refresh-blanks.mjs` helper.
 */

import { getServiceClient } from "@/lib/supabase/admin";
import { getCatalogConfig, getPrintAreaInches } from "@/lib/printful/catalog";
import {
  isPrintfulConfigured,
  type PrintfulFileLayer,
} from "@/lib/printful/client";
import {
  buildCatalogMockupProductPayload,
  createMockupGeneratorTask,
  fetchCatalogMockupStyles,
  pickFlatMockupStyleForVariant,
  waitForMockupTaskMockupUrl,
} from "@/lib/printful/mockups";
import { printfulRequest } from "@/lib/printful/client";
import type { ProductType } from "@/lib/types";

const BUCKET = "design-images";
const DUMMY_PATH = "_system/blank-print-layer.png";

/** Smallest possible transparent PNG (1×1, 67 bytes). */
const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=";

export interface BlankMockupRow {
  product_type: ProductType;
  mockup_url: string;
  catalog_product_id: number | null;
  catalog_variant_id: number | null;
  mockup_style_id: number | null;
  technique: string | null;
  placement: string | null;
  /** From `placement_dimensions[placement].width` (inches). Overrides hardcoded DEFAULT_PRINT_AREA_IN. */
  print_area_width_in: number | null;
  print_area_height_in: number | null;
  generated_at: string;
}

let dummyUrlMemo: string | null = null;

/**
 * Idempotently uploads a 1×1 transparent PNG and returns its public URL.
 * We need a real, externally-fetchable HTTP URL because Printful's mockup
 * job fetches the file server-side — data URLs and localhost URLs both fail.
 */
async function ensureDummyDesignUrl(): Promise<string> {
  if (dummyUrlMemo) return dummyUrlMemo;

  const supabase = getServiceClient();
  const { data: existing } = supabase.storage.from(BUCKET).getPublicUrl(DUMMY_PATH);

  if (existing?.publicUrl) {
    /** Head check ensures we didn't paper over a missing object with an optimistic URL. */
    try {
      const head = await fetch(existing.publicUrl, { method: "HEAD" });
      if (head.ok) {
        dummyUrlMemo = existing.publicUrl;
        return dummyUrlMemo;
      }
    } catch {
      // fall through to (re-)upload
    }
  }

  const bytes = Buffer.from(TRANSPARENT_PNG_BASE64, "base64");
  const { error } = await supabase.storage.from(BUCKET).upload(DUMMY_PATH, bytes, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) {
    throw new Error(`Failed to upload blank dummy PNG: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(DUMMY_PATH);
  if (!data?.publicUrl) {
    throw new Error("Dummy PNG uploaded but no public URL returned");
  }
  dummyUrlMemo = data.publicUrl;
  return dummyUrlMemo;
}

interface PlacementDim {
  placement?: string;
  width?: number;
  height?: number;
}

interface CatalogVariantSummary {
  catalogProductId: number | null;
  placementDims: PlacementDim[];
}

/**
 * Fetch the variant's `catalog_product_id` AND its `placement_dimensions[]`
 * in a single call. Printful exposes per-placement print-area sizes (in
 * inches) here, which we cache so the editor can size its print box to
 * the real SKU instead of a hardcoded default.
 */
async function fetchCatalogVariantSummary(catalogVariantId: number): Promise<CatalogVariantSummary> {
  try {
    const res = await printfulRequest<{
      data?: {
        catalog_product_id?: number;
        placement_dimensions?: PlacementDim[];
      };
    }>(`/catalog-variants/${catalogVariantId}`);
    const data = res.data ?? {};
    return {
      catalogProductId: typeof data.catalog_product_id === "number" ? data.catalog_product_id : null,
      placementDims: Array.isArray(data.placement_dimensions) ? data.placement_dimensions : [],
    };
  } catch (err) {
    console.warn(
      "[Printful blank-mockup] catalog-variants fetch failed:",
      err instanceof Error ? err.message : err,
    );
    return { catalogProductId: null, placementDims: [] };
  }
}

/** First `placement_dimensions` entry whose `placement` matches; sizes may be 0/missing on some embroidery SKUs. */
function pickPrintAreaForPlacement(
  dims: PlacementDim[],
  placement: string,
): { width: number; height: number } | null {
  const match = dims.find((d) => d.placement === placement);
  if (!match) return null;
  const w = typeof match.width === "number" && match.width > 0 ? match.width : null;
  const h = typeof match.height === "number" && match.height > 0 ? match.height : null;
  if (!w || !h) return null;
  return { width: w, height: h };
}

export interface BlankMockupResult {
  url: string;
  catalogProductId: number;
  catalogVariantId: number;
  mockupStyleId: number;
  /** Print area in inches for the configured placement, when Printful reports it. */
  printArea: { width: number; height: number } | null;
}

/**
 * Generate a flat blank mockup via Printful's mockup-tasks API.
 * Synchronous — waits for the task to complete (up to ~55s).
 */
export async function generateFlatBlankMockup(
  productType: ProductType,
): Promise<BlankMockupResult | null> {
  if (!isPrintfulConfigured()) return null;

  const cfg = getCatalogConfig(productType);
  if (!cfg) return null;

  const summary = await fetchCatalogVariantSummary(cfg.catalogVariantId);
  const catalogProductId = summary.catalogProductId;
  if (!catalogProductId) return null;

  const printArea = pickPrintAreaForPlacement(summary.placementDims, cfg.placement);

  const groups = await fetchCatalogMockupStyles(catalogProductId, cfg.placement, {
    includeAll: true,
  });
  const picked = pickFlatMockupStyleForVariant(
    groups,
    cfg.placement,
    cfg.technique,
    cfg.catalogVariantId,
  );
  if (!picked) {
    console.warn(
      `[Printful blank-mockup] No mockup style for catalog_product=${catalogProductId} placement=${cfg.placement}`,
    );
    return null;
  }

  const dummyUrl = await ensureDummyDesignUrl();

  /**
   * Position the (transparent) layer as a tiny 1×1 in. block in the center of
   * the print area. We intentionally pick the smallest realistic position so
   * we never trip Printful's "Printfile X exceeds print area Y" validation
   * — our hardcoded `getPrintAreaInches` defaults are *approximations* and
   * the real per-SKU box reported by Printful is sometimes a bit smaller.
   */
  const area = getPrintAreaInches(productType);
  const Aw = area?.width ?? 12;
  const Ah = area?.height ?? 15;
  /** Clamp the position to a safe interior box; the layer itself is transparent so position is irrelevant for the rendered photo. */
  const dummyW = Math.min(1, Aw);
  const dummyH = Math.min(1, Ah);
  const layer: PrintfulFileLayer = {
    type: "file",
    url: dummyUrl,
    position: {
      area_width: Aw,
      area_height: Ah,
      width: dummyW,
      height: dummyH,
      left: Math.max(0, (Aw - dummyW) / 2),
      top: Math.max(0, (Ah - dummyH) / 2),
    },
  };

  const payload = {
    format: "jpg",
    mockup_width_px: 1200,
    products: [
      buildCatalogMockupProductPayload({
        catalogProductId,
        catalogVariantIds: [cfg.catalogVariantId],
        mockupStyleIds: [picked.styleId],
        placement: cfg.placement,
        technique: cfg.technique,
        printAreaType: picked.printAreaType,
        layer,
      }),
    ],
  };

  const taskId = await createMockupGeneratorTask(payload);
  const url = await waitForMockupTaskMockupUrl(taskId, { timeoutMs: 60_000 });

  return {
    url,
    catalogProductId,
    catalogVariantId: cfg.catalogVariantId,
    mockupStyleId: picked.styleId,
    printArea,
  };
}

/**
 * Get the cached flat blank mockup URL for a product type, generating it via
 * Printful on cache miss. Returns `null` on any failure so callers fall back
 * gracefully (typically to the SVG silhouette).
 */
export async function getOrGenerateFlatBlankMockup(
  productType: ProductType,
): Promise<BlankMockupRow | null> {
  let supabase;
  try {
    supabase = getServiceClient();
  } catch {
    /** Service role unavailable — skip DB cache, just call Printful inline. */
    const generated = await generateFlatBlankMockup(productType).catch(() => null);
    if (!generated) return null;
    return {
      product_type: productType,
      mockup_url: generated.url,
      catalog_product_id: generated.catalogProductId,
      catalog_variant_id: generated.catalogVariantId,
      mockup_style_id: generated.mockupStyleId,
      technique: null,
      placement: null,
      print_area_width_in: generated.printArea?.width ?? null,
      print_area_height_in: generated.printArea?.height ?? null,
      generated_at: new Date().toISOString(),
    };
  }

  const { data: cached, error } = await supabase
    .from("printful_blank_mockups")
    .select("*")
    .eq("product_type", productType)
    .maybeSingle();

  if (!error && cached?.mockup_url) {
    return cached as BlankMockupRow;
  }

  const generated = await generateFlatBlankMockup(productType).catch((err) => {
    console.warn(
      `[Printful blank-mockup] generation failed for ${productType}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  });
  if (!generated) return null;

  const cfg = getCatalogConfig(productType);
  const row: BlankMockupRow = {
    product_type: productType,
    mockup_url: generated.url,
    catalog_product_id: generated.catalogProductId,
    catalog_variant_id: generated.catalogVariantId,
    mockup_style_id: generated.mockupStyleId,
    technique: cfg?.technique ?? null,
    placement: cfg?.placement ?? null,
    print_area_width_in: generated.printArea?.width ?? null,
    print_area_height_in: generated.printArea?.height ?? null,
    generated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabase
    .from("printful_blank_mockups")
    .upsert(row, { onConflict: "product_type" });
  if (upsertErr) {
    console.warn("[Printful blank-mockup] cache upsert failed:", upsertErr.message);
  }

  return row;
}

/** Force-refresh: regenerate the blank mockup ignoring the cache. */
export async function refreshFlatBlankMockup(
  productType: ProductType,
): Promise<BlankMockupRow | null> {
  const supabase = getServiceClient();
  await supabase.from("printful_blank_mockups").delete().eq("product_type", productType);
  return getOrGenerateFlatBlankMockup(productType);
}
