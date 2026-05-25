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
 *   4. Poll until the task completes, then re-host the rendered JPEG into our
 *      own `design-images` bucket and persist that durable URL in
 *      `printful_blank_mockups` keyed by ProductType.
 *
 * Why we re-host: Printful's mockup-tasks API returns URLs under
 * `printful-upload.s3-accelerate.amazonaws.com/tmp/…`. Despite earlier
 * assumptions to the contrary, those `/tmp/` objects expire (S3 returns 403
 * within ~days), which silently bricks the placement editor backdrop. By
 * copying the bytes into our own public bucket we get a permanent URL and
 * decouple the editor from Printful's CDN garbage-collection schedule.
 *
 * Subsequent calls hit the DB cache (process-warm cache wraps that). To
 * regenerate, run `scripts/printful-refresh-blanks.mjs --force`.
 */

import { getServiceClient } from "@/lib/supabase/admin";
import {
  getCatalogConfig,
  getPrintAreaInches,
  printfulCatalogVariantEnvName,
} from "@/lib/printful/catalog";
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
/** Re-hosted flat blank mockups live alongside the dummy layer. */
const REHOST_PREFIX = "_system/blank-mockups";

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

/**
 * Printful techniques that derive layer placement from the catalog template
 * (not from a client-supplied `position`). Sending a `position` for these
 * yields 400s like "Invalid position" or "Providing custom layer positions
 * with Knitwear products is not possible".
 */
const POSITIONLESS_TECHNIQUES = new Set<string>(["embroidery", "knitting", "cut-sew"]);

function positionAllowedForTechnique(technique: string): boolean {
  return !POSITIONLESS_TECHNIQUES.has(technique.toLowerCase());
}

function buildCenteredDummyLayer(dummyUrl: string, productType: ProductType): PrintfulFileLayer {
  const area = getPrintAreaInches(productType);
  const Aw = area?.width ?? 12;
  const Ah = area?.height ?? 15;
  /** Smallest realistic 1x1 block in the centre; transparent, so position is rendered-irrelevant. */
  const w = Math.min(1, Aw);
  const h = Math.min(1, Ah);
  return {
    type: "file",
    url: dummyUrl,
    position: {
      area_width: Aw,
      area_height: Ah,
      width: w,
      height: h,
      left: Math.max(0, (Aw - w) / 2),
      top: Math.max(0, (Ah - h) / 2),
    },
  };
}

/**
 * Per-product overrides for the `product_options` array on the
 * mockup-tasks `products[]` payload. Some catalog SKUs reject the request
 * without these:
 *   - All-Over-Print backpack: `stitch_color` is required (capitalized
 *     values per Printful catalog — "Black" / "White").
 *   - Knitwear (pet sweater): "Design data contains placements without
 *     base color" unless `base_color` is supplied alongside knit-specific
 *     `trim_color` / `color_reduction_mode`.
 *
 * Values here are neutral defaults intended only for rendering a blank
 * mockup. Real orders re-derive them from buyer-facing options.
 */
function requiredCatalogOptionsFor(
  productType: ProductType,
): Array<{ name: string; value: string }> | null {
  if (productType === "backpack") {
    /** Allowed values are lowercase: [white, clear, black]. */
    return [{ name: "stitch_color", value: "black" }];
  }
  if (productType === "pet-sweater") {
    /**
     * Knitted Pet Sweater (catalog_product_id 964) only accepts
     * `base_color` and `color_reduction_mode` per the Printful catalog —
     * `trim_color` is documented for knitwear in general but rejected on
     * this specific product. The `base_color` value must be one of
     * Printful's allowed yarn hexes (e.g. `#c6b5a7` cream, `#090909`
     * black). The variant SKU's "Custom" color (`#dedede`) is NOT in the
     * allowed list — buyers choose a real yarn at order time.
     */
    return [
      { name: "base_color", value: "#c6b5a7" },
      { name: "color_reduction_mode", value: "pixelated" },
    ];
  }
  return null;
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
  console.log("[blank-mockup] generate: start", { productType });
  if (!isPrintfulConfigured()) {
    console.warn("[blank-mockup] generate: PRINTFUL_API_TOKEN missing", { productType });
    return null;
  }

  const cfg = getCatalogConfig(productType);
  if (!cfg) {
    console.warn("[blank-mockup] generate: no catalog config (variant env unset)", {
      productType,
      envVar: printfulCatalogVariantEnvName(productType),
    });
    return null;
  }
  console.log("[blank-mockup] generate: catalog config", {
    productType,
    catalogVariantId: cfg.catalogVariantId,
    placement: cfg.placement,
    technique: cfg.technique,
  });

  const summary = await fetchCatalogVariantSummary(cfg.catalogVariantId);
  const catalogProductId = summary.catalogProductId;
  if (!catalogProductId) {
    console.warn("[blank-mockup] generate: catalog-variants summary missing product id", {
      productType,
      catalogVariantId: cfg.catalogVariantId,
    });
    return null;
  }

  const printArea = pickPrintAreaForPlacement(summary.placementDims, cfg.placement);
  console.log("[blank-mockup] generate: variant summary", {
    productType,
    catalogProductId,
    placement: cfg.placement,
    printArea,
  });

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
    console.warn("[blank-mockup] generate: no mockup style matched", {
      productType,
      catalogProductId,
      placement: cfg.placement,
      technique: cfg.technique,
    });
    return null;
  }
  console.log("[blank-mockup] generate: mockup style picked", {
    productType,
    styleId: picked.styleId,
    printAreaType: picked.printAreaType,
  });

  const dummyUrl = await ensureDummyDesignUrl();

  /**
   * Build the layer. For DTG / DTF / sublimation / digital we pass a tiny
   * centered position so we never trip Printful's "Printfile exceeds print
   * area" validation. For embroidery / knitwear / cut-sew Printful rejects
   * custom positions outright ("Invalid position" / "Providing custom layer
   * positions with Knitwear products is not possible") — those techniques
   * derive position from the placement template, so we omit `position`.
   */
  const layer: PrintfulFileLayer = positionAllowedForTechnique(cfg.technique)
    ? buildCenteredDummyLayer(dummyUrl, productType)
    : { type: "file", url: dummyUrl };

  const productPayload = buildCatalogMockupProductPayload({
    catalogProductId,
    catalogVariantIds: [cfg.catalogVariantId],
    mockupStyleIds: [picked.styleId],
    placement: cfg.placement,
    technique: cfg.technique,
    printAreaType: picked.printAreaType,
    layer,
  });

  /**
   * Some catalog SKUs require additional product options before Printful
   * will render. The shape mandated by the v2 mockup-tasks endpoint is
   * `product_options: [{ name, value }]` at the product level (NOT
   * `options: [{ id, value }]` — that shape is silently ignored).
   *
   *   - All-Over-Print backpack: `stitch_color` ("Black" / "White")
   *   - Knitwear (pet sweater): `base_color`, `trim_color`,
   *     `color_reduction_mode`
   *
   * Per-listing orders re-derive these from the buyer-facing options.
   */
  const productOptions = requiredCatalogOptionsFor(productType);
  const products = productOptions
    ? [{ ...productPayload, product_options: productOptions }]
    : [productPayload];

  const payload = {
    format: "jpg",
    mockup_width_px: 1200,
    products,
  };

  const taskId = await createMockupGeneratorTask(payload);
  console.log("[blank-mockup] generate: task created", { productType, taskId });
  const printfulUrl = await waitForMockupTaskMockupUrl(taskId, { timeoutMs: 60_000 });
  console.log("[blank-mockup] generate: task completed", {
    productType,
    taskId,
    printfulUrl,
  });

  /**
   * Re-host into our own storage so the URL doesn't expire. If the rehost
   * itself fails (e.g. transient Supabase storage issue), fall back to the
   * raw Printful URL — the editor will still work for a while, and the next
   * cache refresh will retry the upload.
   */
  const rehosted = await rehostMockupToStorage(productType, printfulUrl).catch((err) => {
    console.warn("[blank-mockup] generate: re-host to Supabase failed", {
      productType,
      printfulUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  });
  if (rehosted) {
    console.log("[blank-mockup] generate: re-hosted to Supabase", {
      productType,
      url: rehosted,
    });
  } else {
    console.warn("[blank-mockup] generate: falling back to ephemeral Printful URL", {
      productType,
      printfulUrl,
    });
  }

  return {
    url: rehosted ?? printfulUrl,
    catalogProductId,
    catalogVariantId: cfg.catalogVariantId,
    mockupStyleId: picked.styleId,
    printArea,
  };
}

/**
 * Download `sourceUrl` from Printful's temporary S3 bucket and re-upload the
 * JPEG into our own public `design-images` bucket at a stable path. Returns
 * the durable Supabase public URL.
 *
 * Critical: Printful's mockup-tasks API returns URLs under
 * `printful-upload.s3-accelerate.amazonaws.com/tmp/<uuid>/<filename>` and
 * those `/tmp/` objects expire (S3 starts returning 403 within days). Storing
 * that ephemeral URL in `printful_blank_mockups` silently bricked the
 * placement editor backdrop in production. By copying the bytes into our own
 * bucket the URL is stable for the lifetime of the row.
 */
async function rehostMockupToStorage(
  productType: ProductType,
  sourceUrl: string,
): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`download ${sourceUrl} returned ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";

  const supabase = getServiceClient();
  const path = `${REHOST_PREFIX}/${productType}.${ext}`;
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (uploadErr) {
    throw new Error(`upload ${path} failed: ${uploadErr.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error(`no public URL for ${path}`);
  }
  /**
   * Cache-bust query param so CDN / next/image revalidate when a refresh
   * replaces the same path. The bytes are content-addressed by ProductType,
   * so a timestamp is fine here (no risk of cache pollution across types).
   */
  return `${data.publicUrl}?v=${Date.now()}`;
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

  if (error) {
    console.warn("[blank-mockup] persist: DB select error", {
      productType,
      error: error.message,
    });
  }
  if (!error && cached?.mockup_url) {
    console.log("[blank-mockup] persist: returning existing DB row (no regeneration)", {
      productType,
      url: cached.mockup_url,
    });
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
    console.warn("[blank-mockup] persist: cache upsert failed", {
      productType,
      error: upsertErr.message,
    });
  } else {
    console.log("[blank-mockup] persist: cache upsert succeeded", {
      productType,
      url: row.mockup_url,
    });
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
