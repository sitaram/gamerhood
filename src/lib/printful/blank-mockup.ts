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
 *   2. Pick a Ghost mockup style from `/v2/catalog-products/{id}/mockup-styles`.
 *      Ghost shares the same coordinate frame as Printful's mockup-templates
 *      `print_area_*` fields — what `layer.position` is composited against.
 *      (Flat / Flat 2 styles re-frame the garment and must not be paired with
 *      template-derived pixel coords.)
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
  pickTemplateAlignedMockupStyleForVariant,
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
  /** Printful catalog color name for this variant (post-030 schema). */
  color_name?: string | null;
  /** `color_code` from /catalog-variants/{id} (post-030 schema). */
  color_hex?: string | null;
  /** "catalog_image" (Track A) or "mockup_task" (Track B). */
  source?: string | null;
  /**
   * Pixel-space coordinates for the cyan print frame ON the rendered
   * `mockup_url`. Sourced from Printful's v1
   * `/mockup-generator/templates/{product_id}` endpoint and scaled to the
   * mockup-tasks output size (typically 1200×1200). When populated,
   * surfaces composite the print box at these exact pixel offsets instead
   * of falling back to the hand-tuned `photoBand` percentages in
   * `merch-preview-layout.ts`. `null` for variants whose product line has
   * no v1 template (some embroidery / cut-sew / knit SKUs).
   */
  mockup_width_px?: number | null;
  mockup_height_px?: number | null;
  print_area_x_px?: number | null;
  print_area_y_px?: number | null;
  print_area_w_px?: number | null;
  print_area_h_px?: number | null;
  template_id?: number | null;
  generated_at: string;
}

/**
 * Pixel-space print-area rectangle for a variant's rendered flat mockup.
 * `mockupWidthPx` / `mockupHeightPx` describe the mockup the editor
 * actually serves (so callers can convert to percentages via
 * `xPx / mockupWidthPx` etc.); `xPx`/`yPx`/`wPx`/`hPx` are the cyan
 * frame's top-left corner + size in that same pixel space.
 */
export interface VariantPrintAreaPx {
  templateId: number;
  mockupWidthPx: number;
  mockupHeightPx: number;
  xPx: number;
  yPx: number;
  wPx: number;
  hPx: number;
}

function assertValidVariantPrintAreaPx(
  px: VariantPrintAreaPx,
  context: {
    productType: ProductType;
    catalogVariantId: number;
    placement: string | null;
    templateId: number | null;
  },
): void {
  const finite =
    Number.isFinite(px.mockupWidthPx) &&
    Number.isFinite(px.mockupHeightPx) &&
    Number.isFinite(px.xPx) &&
    Number.isFinite(px.yPx) &&
    Number.isFinite(px.wPx) &&
    Number.isFinite(px.hPx);
  if (!finite) {
    throw new Error(
      `[blank-mockup] invalid template pixel rect (${context.productType}/${context.catalogVariantId}): non-finite values`,
    );
  }
  if (px.mockupWidthPx <= 0 || px.mockupHeightPx <= 0 || px.wPx <= 0 || px.hPx <= 0) {
    throw new Error(
      `[blank-mockup] invalid template pixel rect (${context.productType}/${context.catalogVariantId}): non-positive dimensions`,
    );
  }
  if (px.xPx < 0 || px.yPx < 0) {
    throw new Error(
      `[blank-mockup] invalid template pixel rect (${context.productType}/${context.catalogVariantId}): negative origin`,
    );
  }
  if (px.xPx + px.wPx > px.mockupWidthPx || px.yPx + px.hPx > px.mockupHeightPx) {
    throw new Error(
      `[blank-mockup] invalid template pixel rect (${context.productType}/${context.catalogVariantId}): out of bounds (template=${context.templateId ?? "n/a"}, placement=${context.placement ?? "n/a"})`,
    );
  }
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
  /**
   * Per-variant blank product photo from Printful's catalog (e.g.
   * `https://files.cdn.printful.com/products/146/9220_…jpg`). Per the v2
   * docs this is the studio flat shot in the variant's actual color —
   * stable, not an expiring `/tmp/` URL like mockup-tasks output. Empty
   * string when Printful didn't ship one (rare, accessory SKUs).
   */
  imageUrl: string | null;
  colorName: string | null;
  colorHex: string | null;
}

/**
 * Fetch the variant's `catalog_product_id`, `placement_dimensions[]`,
 * `image`, and color metadata in a single call. Printful exposes per-
 * placement print-area sizes (in inches) here as well as the per-color
 * blank product photo we use as the storefront backdrop for non-default
 * colors (Track A in `getOrGenerateBlankForVariantId`).
 */
async function fetchCatalogVariantSummary(catalogVariantId: number): Promise<CatalogVariantSummary> {
  try {
    const res = await printfulRequest<{
      data?: {
        catalog_product_id?: number;
        placement_dimensions?: PlacementDim[];
        image?: string;
        product_image?: string;
        color?: string;
        color_code?: string;
      };
    }>(`/catalog-variants/${catalogVariantId}`);
    const data = res.data ?? {};
    const rawImage =
      (typeof data.image === "string" && data.image.trim()) ||
      (typeof data.product_image === "string" && data.product_image.trim()) ||
      "";
    return {
      catalogProductId: typeof data.catalog_product_id === "number" ? data.catalog_product_id : null,
      placementDims: Array.isArray(data.placement_dimensions) ? data.placement_dimensions : [],
      imageUrl: rawImage || null,
      colorName: typeof data.color === "string" && data.color.trim() ? data.color.trim() : null,
      colorHex: typeof data.color_code === "string" && data.color_code.trim() ? data.color_code.trim() : null,
    };
  } catch (err) {
    console.warn(
      "[Printful blank-mockup] catalog-variants fetch failed:",
      err instanceof Error ? err.message : err,
    );
    return {
      catalogProductId: null,
      placementDims: [],
      imageUrl: null,
      colorName: null,
      colorHex: null,
    };
  }
}

/**
 * Page through `/catalog-products/{id}/catalog-variants` and return one
 * representative variant per unique color name. The caller uses this to
 * warm a single per-color blank without enumerating every size×color SKU
 * (most apparel ships ~5 sizes × ~10 colors = ~50 variants; we only need
 * 10 photos because the color photo is identical across sizes).
 */
export interface CatalogColorVariant {
  variantId: number;
  colorName: string;
  colorHex: string | null;
  /** Set when Printful returned a non-empty `image` for the variant — Track A is viable. */
  imageUrl: string | null;
}

export async function listColorVariantsForCatalogProduct(
  catalogProductId: number,
): Promise<CatalogColorVariant[]> {
  if (!isPrintfulConfigured()) return [];

  const seen = new Map<string, CatalogColorVariant>();
  const limit = 100;
  let offset = 0;

  while (offset < 2_000) {
    let page;
    try {
      page = await printfulRequest<{
        data?: Array<{
          id?: number;
          color?: string;
          color_code?: string;
          image?: string;
          product_image?: string;
        }>;
        paging?: { total?: number; offset?: number; limit?: number };
      }>(`/catalog-products/${catalogProductId}/catalog-variants?offset=${offset}&limit=${limit}`);
    } catch (err) {
      console.warn("[Printful blank-mockup] catalog-variants list failed", {
        catalogProductId,
        offset,
        error: err instanceof Error ? err.message : String(err),
      });
      break;
    }

    const rows = Array.isArray(page.data) ? page.data : [];
    for (const v of rows) {
      const id = typeof v.id === "number" ? v.id : null;
      const name = typeof v.color === "string" ? v.color.trim() : "";
      if (!id || !name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      const rawImage =
        (typeof v.image === "string" && v.image.trim()) ||
        (typeof v.product_image === "string" && v.product_image.trim()) ||
        "";
      seen.set(key, {
        variantId: id,
        colorName: name,
        colorHex:
          typeof v.color_code === "string" && v.color_code.trim() ? v.color_code.trim() : null,
        imageUrl: rawImage || null,
      });
    }

    const total = page.paging?.total ?? rows.length;
    offset += rows.length || limit;
    if (rows.length < limit || offset >= total) break;
  }

  return [...seen.values()];
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
  mockupStyleId: number | null;
  /** Print area in inches for the configured placement, when Printful reports it. */
  printArea: { width: number; height: number } | null;
  /** Pixel coords of the cyan frame on the rendered mockup, when templates ship one. */
  printAreaPx: VariantPrintAreaPx | null;
  /** From mockup-templates `background_color` — tint behind the template image. */
  backdropColor?: string | null;
  source: "template_backdrop" | "catalog_image" | "mockup_task";
}

interface CatalogMockupTemplateRow {
  catalog_variant_ids?: number[];
  placement?: string;
  technique?: string;
  image_url?: string;
  background_color?: string | null;
  template_width?: number;
  template_height?: number;
  print_area_width?: number;
  print_area_height?: number;
  print_area_top?: number;
  print_area_left?: number;
  printfile_id?: number;
  role?: string;
}

async function fetchCatalogMockupTemplateForVariant(input: {
  catalogProductId: number;
  catalogVariantId: number;
  placement: string;
}): Promise<CatalogMockupTemplateRow | null> {
  try {
    const res = await printfulRequest<{ data?: CatalogMockupTemplateRow[] }>(
      `/catalog-products/${input.catalogProductId}/mockup-templates?placements=${encodeURIComponent(
        input.placement,
      )}`,
    );
    const rows = Array.isArray(res.data) ? res.data : [];
    const forVariant = rows.filter((r) =>
      r.catalog_variant_ids?.includes(input.catalogVariantId),
    );
    return (
      forVariant.find(
        (r) =>
          r.placement === input.placement &&
          r.role === "primary" &&
          r.print_area_width &&
          r.print_area_height &&
          r.image_url,
      ) ??
      forVariant.find(
        (r) =>
          r.placement === input.placement &&
          r.print_area_width &&
          r.print_area_height &&
          r.image_url,
      ) ??
      null
    );
  } catch (err) {
    console.warn("[blank-mockup] mockup-templates v2 fetch failed", {
      catalogProductId: input.catalogProductId,
      catalogVariantId: input.catalogVariantId,
      placement: input.placement,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function scaleTemplatePrintAreaPx(
  tmpl: CatalogMockupTemplateRow,
  templateId: number,
  outputWidthPx: number,
): VariantPrintAreaPx | null {
  if (
    !tmpl.template_width ||
    !tmpl.template_height ||
    !tmpl.print_area_width ||
    !tmpl.print_area_height ||
    tmpl.print_area_top == null ||
    tmpl.print_area_left == null
  ) {
    return null;
  }
  const scale = outputWidthPx / tmpl.template_width;
  return {
    templateId,
    mockupWidthPx: outputWidthPx,
    mockupHeightPx: tmpl.template_height * scale,
    xPx: tmpl.print_area_left * scale,
    yPx: tmpl.print_area_top * scale,
    wPx: tmpl.print_area_width * scale,
    hPx: tmpl.print_area_height * scale,
  };
}

/**
 * Fetch the pixel-space print-area rectangle for `(variantId, placement)`
 * from Printful's v2 `/catalog-products/{id}/mockup-templates` endpoint
 * and scale it to the mockup-tasks output we serve (`outputWidthPx`,
 * default 1200 — matches `mockup_width_px` in `generateFlatBlankMockup`).
 *
 * These coords describe where Printful composites `layer.position` on the
 * Ghost/template backdrop — the same frame used at fulfillment time. They
 * MUST NOT be overlaid on Flat / Flat 2 / lifestyle mockup styles.
 *
 * Returns `null` when the request fails or the variant has no template row
 * (some embroidery / cut-sew / knitwear SKUs). Callers fall back to
 * `photoBand` — no error path.
 */
export async function fetchVariantPrintAreaPx(input: {
  catalogProductId: number;
  catalogVariantId: number;
  placement: string;
  outputWidthPx?: number;
}): Promise<VariantPrintAreaPx | null> {
  const outputWidthPx = input.outputWidthPx ?? 1200;
  const tmpl = await fetchCatalogMockupTemplateForVariant(input);
  if (!tmpl) {
    console.warn("[blank-mockup] mockup-templates v2: no row for variant/placement", {
      catalogProductId: input.catalogProductId,
      catalogVariantId: input.catalogVariantId,
      placement: input.placement,
    });
    return null;
  }
  const templateId = tmpl.printfile_id ?? 0;
  return scaleTemplatePrintAreaPx(tmpl, templateId, outputWidthPx);
}

/**
 * Placement-editor backdrop sourced directly from Printful's
 * `/mockup-templates` row: the `image_url` and `print_area_*` fields share
 * one coordinate frame (what Printful uses when compositing `layer.position`).
 * Fast (~1 s) and avoids mockup-style / template drift from Flat mockups.
 */
export async function generateTemplateBackdropMockup(
  productType: ProductType,
): Promise<BlankMockupResult | null> {
  console.log("[blank-mockup] template-backdrop: start", { productType });
  if (!isPrintfulConfigured()) return null;

  const cfg = getCatalogConfig(productType);
  if (!cfg) return null;

  const summary = await fetchCatalogVariantSummary(cfg.catalogVariantId);
  const catalogProductId = summary.catalogProductId;
  if (!catalogProductId) return null;

  const tmpl = await fetchCatalogMockupTemplateForVariant({
    catalogProductId,
    catalogVariantId: cfg.catalogVariantId,
    placement: cfg.placement,
  });
  if (!tmpl?.image_url) {
    console.warn("[blank-mockup] template-backdrop: no template image", { productType });
    return null;
  }

  const printArea = pickPrintAreaForPlacement(summary.placementDims, cfg.placement);
  const printAreaPx = scaleTemplatePrintAreaPx(
    tmpl,
    tmpl.printfile_id ?? 0,
    1200,
  );
  if (printAreaPx) {
    assertValidVariantPrintAreaPx(printAreaPx, {
      productType,
      catalogVariantId: cfg.catalogVariantId,
      placement: cfg.placement,
      templateId: tmpl.printfile_id ?? null,
    });
  }

  const rehosted = await rehostImageToStorage(
    `tpl-${cfg.catalogVariantId}`,
    tmpl.image_url,
  ).catch((err) => {
    console.warn("[blank-mockup] template-backdrop: rehost failed", {
      productType,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  });
  if (!rehosted) return null;

  console.log("[blank-mockup] template-backdrop: ready", {
    productType,
    url: rehosted,
    hasPixelRect: !!printAreaPx,
  });

  return {
    url: rehosted,
    catalogProductId,
    catalogVariantId: cfg.catalogVariantId,
    mockupStyleId: null,
    printArea,
    printAreaPx,
    backdropColor: tmpl.background_color ?? summary.colorHex,
    source: "template_backdrop",
  };
}

/**
 * Variant-scoped template backdrop generator.
 *
 * Unlike `generateTemplateBackdropMockup(productType)`, this resolves the
 * mockup-template image for an explicit catalog variant id so per-color
 * blanks share the same coordinate frame + print-area pixel rect as the
 * default color.
 */
async function generateTemplateBackdropForVariant(
  variantId: number,
  productType: ProductType,
): Promise<{
  result: BlankMockupResult;
  colorName: string | null;
  colorHex: string | null;
} | null> {
  if (!isPrintfulConfigured()) return null;
  const cfg = getCatalogConfig(productType);
  if (!cfg) return null;

  const summary = await fetchCatalogVariantSummary(variantId);
  if (!summary.catalogProductId) return null;

  const tmpl = await fetchCatalogMockupTemplateForVariant({
    catalogProductId: summary.catalogProductId,
    catalogVariantId: variantId,
    placement: cfg.placement,
  });
  if (!tmpl?.image_url) return null;

  const rehosted = await rehostImageToStorage(`tpl-v-${variantId}`, tmpl.image_url).catch((err) => {
    console.warn("[blank-mockup] template-backdrop(v): rehost failed", {
      variantId,
      productType,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  });
  if (!rehosted) return null;

  const printArea = pickPrintAreaForPlacement(summary.placementDims, cfg.placement);
  const printAreaPx = scaleTemplatePrintAreaPx(tmpl, tmpl.printfile_id ?? 0, 1200);
  if (printAreaPx) {
    assertValidVariantPrintAreaPx(printAreaPx, {
      productType,
      catalogVariantId: variantId,
      placement: cfg.placement,
      templateId: tmpl.printfile_id ?? null,
    });
  }

  return {
    result: {
      url: rehosted,
      catalogProductId: summary.catalogProductId,
      catalogVariantId: variantId,
      mockupStyleId: null,
      printArea,
      printAreaPx,
      backdropColor: tmpl.background_color ?? summary.colorHex,
      source: "template_backdrop",
    },
    colorName: summary.colorName,
    colorHex: summary.colorHex,
  };
}

/** True when a cached row is safe to serve for the placement editor. */
export async function isTemplateAlignedBlankRow(
  row: BlankMockupRow,
  _productType: ProductType,
): Promise<boolean> {
  void _productType;
  if (row.source === "template_backdrop") return true;
  /** Per-color studio shots — no template pixel overlay (photoBand fallback). */
  if (row.source === "catalog_image") return true;
  /**
   * `mockup_task` rows are still valid flat-product backdrops; they simply
   * don't carry template pixel coordinates. Keep serving them so the create
   * flow shows a real blank while we use photoBand fallback for placement.
   */
  if (row.source === "mockup_task") {
    const url = row.mockup_url ?? "";
    /**
     * Printful mockup-task `/tmp/` URLs expire. If a legacy row still points
     * there, force regeneration so the cache repopulates with a durable
     * re-hosted URL from our own storage.
     */
    if (
      url.includes("printful-upload.s3-accelerate.amazonaws.com/tmp/") ||
      url.includes("files.cdn.printful.com/tmp/")
    ) {
      return false;
    }
    return true;
  }
  /** Unknown/legacy source values should refresh. */
  return false;
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
  /**
   * Ghost mannequin styles share Printful's `/mockup-templates` coordinate
   * frame — the same one `layer.position` is composited against at
   * fulfillment. Flat / Flat 2 styles re-frame the garment and MUST NOT be
   * paired with template-derived `print_area_*_px` overlays.
   */
  const picked = pickTemplateAlignedMockupStyleForVariant(
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
  const rehosted = await rehostImageToStorage(`v-${cfg.catalogVariantId}`, printfulUrl).catch(
    (err) => {
      console.warn("[blank-mockup] generate: re-host to Supabase failed", {
        productType,
        printfulUrl,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    },
  );
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

  const printAreaPx = null;

  return {
    url: rehosted ?? printfulUrl,
    catalogProductId,
    catalogVariantId: cfg.catalogVariantId,
    mockupStyleId: picked.styleId,
    printArea,
    printAreaPx,
    source: "mockup_task",
  };
}

/**
 * Download `sourceUrl` and re-upload the bytes into our own public
 * `design-images` bucket at a stable path. Returns the durable Supabase
 * public URL.
 *
 * Why we re-host:
 *   - Mockup-tasks output (`printful-upload.s3-accelerate.amazonaws.com/tmp/`)
 *     expires within days; storing that URL in `printful_blank_mockups`
 *     silently brick'd the placement editor in production.
 *   - Catalog variant photos on `files.cdn.printful.com` are stable, but
 *     re-hosting them lets us serve every blank from one CDN with one
 *     cache-control story (no Printful CDN dependency at view time).
 *
 * `pathKey` becomes the storage path component, e.g. `"hoodie"` (legacy,
 * one-per-type) or `"v-9220"` (post-030, one-per-variant). The latter
 * pattern keeps every variant in its own object so a single re-warm
 * doesn't invalidate sibling colors.
 */
async function rehostImageToStorage(
  pathKey: string,
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
  const path = `${REHOST_PREFIX}/${pathKey}.${ext}`;
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
   * replaces the same path. The bytes are content-addressed by pathKey,
   * so a timestamp is fine here (no risk of cache pollution across keys).
   */
  return `${data.publicUrl}?v=${Date.now()}`;
}

/**
 * Track A — fast path for non-default colors.
 *
 * Pulls the per-variant `image` URL straight from `/v2/catalog-variants/{id}`
 * and re-hosts to Supabase Storage. Stable, ~1 second per variant, and not
 * subject to mockup-tasks rate limits — so we can warm every color of every
 * product on publish without burning Printful quota. Returns `null` when the
 * variant has no catalog photo (fall through to Track B).
 */
async function generateBlankFromCatalogPhoto(
  variantId: number,
  productType: ProductType,
): Promise<{
  result: BlankMockupResult;
  colorName: string | null;
  colorHex: string | null;
} | null> {
  if (!isPrintfulConfigured()) return null;

  const summary = await fetchCatalogVariantSummary(variantId);
  if (!summary.catalogProductId) {
    console.warn("[blank-mockup] catalog-photo: variant missing catalog_product_id", {
      variantId,
    });
    return null;
  }
  if (!summary.imageUrl) {
    console.warn("[blank-mockup] catalog-photo: variant has no image, falling back to Track B", {
      variantId,
      productType,
      catalogProductId: summary.catalogProductId,
    });
    return null;
  }

  const cfg = getCatalogConfig(productType);
  const printArea = cfg
    ? pickPrintAreaForPlacement(summary.placementDims, cfg.placement)
    : null;

  const rehosted = await rehostImageToStorage(`v-${variantId}`, summary.imageUrl).catch((err) => {
    console.warn("[blank-mockup] catalog-photo: rehost failed", {
      variantId,
      sourceUrl: summary.imageUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  });
  if (!rehosted) return null;

  console.log("[blank-mockup] catalog-photo: rehosted", {
    variantId,
    productType,
    color: summary.colorName,
    url: rehosted,
  });

  /**
   * Catalog studio photos use a different frame than mockup-templates — never
   * attach template pixel coords (placement editor falls back to photoBand).
   */
  return {
    result: {
      url: rehosted,
      catalogProductId: summary.catalogProductId,
      catalogVariantId: variantId,
      mockupStyleId: null,
      printArea,
      printAreaPx: null,
      source: "catalog_image",
    },
    colorName: summary.colorName,
    colorHex: summary.colorHex,
  };
}

/**
 * Get-or-generate the blank for a specific catalog variant id.
 *
 * Look-up order:
 *   1. DB cache row (`catalog_variant_id` PK).
 *   2. Env-default variant → mockup-templates backdrop (placement editor).
 *   3. Other variants → per-color catalog photo (Track A).
 *   4. Fallback → mockup-tasks (~10–30 s) when template + catalog both fail.
 *
 * Returns the persisted row (so callers can read back the cached print area
 * and color metadata in one shot) or `null` on full failure.
 */
export async function getOrGenerateBlankForVariantId(
  variantId: number,
  productType: ProductType,
  opts?: { colorName?: string | null; colorHex?: string | null },
): Promise<BlankMockupRow | null> {
  if (!Number.isFinite(variantId) || variantId <= 0) return null;

  let supabase;
  try {
    supabase = getServiceClient();
  } catch {
    console.warn("[blank-mockup] per-variant: service-role client unavailable", {
      variantId,
      productType,
    });
    return null;
  }

  const { data: cached, error: readErr } = await supabase
    .from("printful_blank_mockups")
    .select("*")
    .eq("catalog_variant_id", variantId)
    .maybeSingle();
  if (readErr) {
    console.warn("[blank-mockup] per-variant: DB select error", {
      variantId,
      error: readErr.message,
    });
  }
  if (cached?.mockup_url) {
    const aligned = await isTemplateAlignedBlankRow(cached as BlankMockupRow, productType);
    if (aligned) {
      console.log("[blank-mockup] per-variant: cache hit", {
        variantId,
        productType,
        url: cached.mockup_url,
      });
      return cached as BlankMockupRow;
    }
    console.warn("[blank-mockup] per-variant: stale mockup style — regenerating", {
      variantId,
      productType,
      mockupStyleId: cached.mockup_style_id,
    });
    await supabase.from("printful_blank_mockups").delete().eq("catalog_variant_id", variantId);
  }

  type TrackPack = {
    result: BlankMockupResult;
    colorName: string | null;
    colorHex: string | null;
  };
  const cfg = getCatalogConfig(productType);
  const isDefaultVariant = cfg?.catalogVariantId === variantId;

  /**
   * Preferred path for ALL colors: variant-scoped template backdrop.
   * This keeps every swatch on the same coordinate system as Printful's
   * template print-area rect, preventing color-dependent drift.
   */
  let track: TrackPack | null = await generateTemplateBackdropForVariant(variantId, productType).catch(
    (err) => {
      console.warn("[blank-mockup] per-variant: template-backdrop(v) threw", {
        variantId,
        productType,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    },
  );

  if (!track) {
    if (isDefaultVariant) {
      const fallback = await generateFlatBlankMockup(productType).catch((err) => {
        console.warn("[blank-mockup] per-variant: mockup-tasks fallback threw", {
          variantId,
          productType,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      });
      if (fallback) {
        track = {
          result: fallback,
          colorName: opts?.colorName ?? null,
          colorHex: fallback.backdropColor ?? opts?.colorHex ?? null,
        };
      }
      if (!track) {
        /**
         * Keep a real photographic blank even when template + mockup-task
         * generation are unavailable for the default variant.
         */
        track = await generateBlankFromCatalogPhoto(variantId, productType).catch((err) => {
          console.warn("[blank-mockup] per-variant: default catalog-photo fallback threw", {
            variantId,
            productType,
            error: err instanceof Error ? err.message : String(err),
          });
          return null;
        });
      }
    } else {
      /**
       * Last-resort non-default path: catalog studio photo. This can drift
       * versus template coords, but is still better than no photo.
       */
      track = await generateBlankFromCatalogPhoto(variantId, productType).catch((err) => {
        console.warn("[blank-mockup] per-variant: catalog-photo fallback threw", {
          variantId,
          productType,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      });
    }
  }

  if (!track) return null;

  const px = track.result.printAreaPx;
  const row: BlankMockupRow = {
    product_type: productType,
    mockup_url: track.result.url,
    catalog_product_id: track.result.catalogProductId,
    catalog_variant_id: track.result.catalogVariantId,
    mockup_style_id: track.result.mockupStyleId || null,
    technique: cfg?.technique ?? null,
    placement: cfg?.placement ?? null,
    print_area_width_in: track.result.printArea?.width ?? null,
    print_area_height_in: track.result.printArea?.height ?? null,
    color_name: opts?.colorName ?? track.colorName ?? null,
    color_hex:
      opts?.colorHex ??
      track.colorHex ??
      track.result.backdropColor ??
      null,
    source: track.result.source,
    mockup_width_px: px?.mockupWidthPx ?? null,
    mockup_height_px: px ? Math.round(px.mockupHeightPx) : null,
    print_area_x_px: px ? Math.round(px.xPx) : null,
    print_area_y_px: px ? Math.round(px.yPx) : null,
    print_area_w_px: px ? Math.round(px.wPx) : null,
    print_area_h_px: px ? Math.round(px.hPx) : null,
    template_id: px?.templateId ?? null,
    generated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabase
    .from("printful_blank_mockups")
    .upsert(row, { onConflict: "catalog_variant_id" });
  if (upsertErr) {
    console.warn("[blank-mockup] per-variant: upsert failed", {
      variantId,
      error: upsertErr.message,
    });
  } else {
    console.log("[blank-mockup] per-variant: upsert ok", {
      variantId,
      productType,
      color: row.color_name,
      source: row.source,
      url: row.mockup_url,
    });
  }

  return row;
}

/**
 * Get the cached flat blank mockup URL for a product type, generating it via
 * Printful on cache miss. Returns `null` on any failure so callers fall back
 * gracefully (typically to the SVG silhouette).
 *
 * Post-030 schema: this resolves to the env-default variant for `productType`
 * and delegates to `getOrGenerateBlankForVariantId`. Callers that want a
 * specific color should call the per-variant function directly.
 */
export async function getOrGenerateFlatBlankMockup(
  productType: ProductType,
): Promise<BlankMockupRow | null> {
  const cfg = getCatalogConfig(productType);
  if (!cfg) {
    console.warn("[blank-mockup] flat-blank: no catalog config", {
      productType,
      envVar: printfulCatalogVariantEnvName(productType),
    });
    return null;
  }
  return getOrGenerateBlankForVariantId(cfg.catalogVariantId, productType);
}

/** Force-refresh: regenerate the default blank mockup ignoring the cache. */
export async function refreshFlatBlankMockup(
  productType: ProductType,
): Promise<BlankMockupRow | null> {
  const cfg = getCatalogConfig(productType);
  if (!cfg) return null;
  const supabase = getServiceClient();
  await supabase
    .from("printful_blank_mockups")
    .delete()
    .eq("catalog_variant_id", cfg.catalogVariantId);
  return getOrGenerateBlankForVariantId(cfg.catalogVariantId, productType);
}
