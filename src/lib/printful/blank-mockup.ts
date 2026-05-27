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
import { printfulRequest, printfulRequestV1 } from "@/lib/printful/client";
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
  mockupStyleId: number;
  /** Print area in inches for the configured placement, when Printful reports it. */
  printArea: { width: number; height: number } | null;
  /** Pixel coords of the cyan frame on the rendered mockup, when v1 templates ship one. */
  printAreaPx: VariantPrintAreaPx | null;
}

interface MockupTemplateRow {
  template_id?: number;
  placement?: string;
  template_width?: number;
  template_height?: number;
  print_area_width?: number;
  print_area_height?: number;
  print_area_top?: number;
  print_area_left?: number;
}

interface MockupTemplatesResponse {
  result?: {
    variant_mapping?: Array<{
      variant_id?: number;
      templates?: Array<{ placement?: string; template_id?: number }>;
    }>;
    templates?: MockupTemplateRow[];
  };
}

/**
 * Fetch the pixel-space print-area rectangle for `(variantId, placement)`
 * from Printful's v1 `/mockup-generator/templates/{catalogProductId}`
 * endpoint and scale it to the mockup-tasks output we serve
 * (`outputWidthPx`, default 1200 — matches `mockup_width_px` in
 * `generateFlatBlankMockup`'s payload).
 *
 * Returns `null` when:
 *   - the request fails (network, 4xx);
 *   - the variant has no template for the placement (some embroidery /
 *     cut-sew / knitwear SKUs);
 *   - the template's `print_area_*` fields are missing (zero/undefined).
 *
 * Callers (`getOrGenerateBlankForVariantId`, the backfill script) treat a
 * null return as "fall back to hand-tuned photoBand" — no error path.
 */
export async function fetchVariantPrintAreaPx(input: {
  catalogProductId: number;
  catalogVariantId: number;
  placement: string;
  outputWidthPx?: number;
}): Promise<VariantPrintAreaPx | null> {
  const outputWidthPx = input.outputWidthPx ?? 1200;
  let res: MockupTemplatesResponse;
  try {
    res = await printfulRequestV1<MockupTemplatesResponse>(
      `/mockup-generator/templates/${input.catalogProductId}?placements=${encodeURIComponent(
        input.placement,
      )}`,
    );
  } catch (err) {
    console.warn("[blank-mockup] templates v1 fetch failed", {
      catalogProductId: input.catalogProductId,
      catalogVariantId: input.catalogVariantId,
      placement: input.placement,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  const variantMap = res.result?.variant_mapping ?? [];
  const variantEntry = variantMap.find((v) => v.variant_id === input.catalogVariantId);
  const templateId = variantEntry?.templates?.find(
    (t) => t.placement === input.placement,
  )?.template_id;
  if (!templateId) {
    console.warn("[blank-mockup] templates v1: no template id for variant/placement", {
      catalogProductId: input.catalogProductId,
      catalogVariantId: input.catalogVariantId,
      placement: input.placement,
    });
    return null;
  }

  const tmpl = (res.result?.templates ?? []).find((t) => t.template_id === templateId);
  if (
    !tmpl ||
    !tmpl.template_width ||
    !tmpl.template_height ||
    !tmpl.print_area_width ||
    !tmpl.print_area_height ||
    tmpl.print_area_top == null ||
    tmpl.print_area_left == null
  ) {
    console.warn("[blank-mockup] templates v1: template row missing print_area_* fields", {
      catalogProductId: input.catalogProductId,
      templateId,
    });
    return null;
  }

  /**
   * Mockup-tasks renders the same template at our requested output width
   * (and the height proportionally — both axes share the template scale).
   * We scale the template-native print-area pixels into mockup-px space
   * so consumers don't have to remember which reference frame this is in.
   */
  const scale = outputWidthPx / tmpl.template_width;
  const mockupHeightPx = tmpl.template_height * scale;
  const xPx = tmpl.print_area_left * scale;
  const yPx = tmpl.print_area_top * scale;
  const wPx = tmpl.print_area_width * scale;
  const hPx = tmpl.print_area_height * scale;

  return {
    templateId,
    mockupWidthPx: outputWidthPx,
    mockupHeightPx,
    xPx,
    yPx,
    wPx,
    hPx,
  };
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

  const printAreaPx = await fetchVariantPrintAreaPx({
    catalogProductId,
    catalogVariantId: cfg.catalogVariantId,
    placement: cfg.placement,
    outputWidthPx: 1200,
  });

  return {
    url: rehosted ?? printfulUrl,
    catalogProductId,
    catalogVariantId: cfg.catalogVariantId,
    mockupStyleId: picked.styleId,
    printArea,
    printAreaPx,
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
   * Track A photos come from `/catalog-variants/{id}.image` (the per-
   * color studio shot), not the mockup-tasks output. Printful's v1
   * `/mockup-generator/templates` coordinates are calibrated to the
   * mockup-tasks rendering (ghost mannequin), so they may NOT line up
   * exactly with the catalog studio photo. We still cache them — the
   * editor / preview surfaces will only use them when the
   * `mockup_url` actually came from the mockup-tasks pipeline
   * (`source = 'mockup_task'`); per-color catalog photos continue to
   * use the photoBand fallback until we render their own coords. This
   * keeps the slow path (placement editor + default-color backdrop)
   * pixel-accurate while leaving the color-swap thumbnails on the
   * existing approximation.
   */
  const printAreaPx = cfg
    ? await fetchVariantPrintAreaPx({
        catalogProductId: summary.catalogProductId,
        catalogVariantId: variantId,
        placement: cfg.placement,
        outputWidthPx: 1200,
      })
    : null;

  return {
    result: {
      url: rehosted,
      catalogProductId: summary.catalogProductId,
      catalogVariantId: variantId,
      mockupStyleId: 0,
      printArea,
      printAreaPx,
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
 *   2. Track A — Printful catalog photo for the variant (fast, ~1 s).
 *   3. Track B — `mockup-tasks` job (~10–30 s, requires the variant to be
 *      the env-configured default for its product type so we have a valid
 *      `getCatalogConfig()` for technique/placement metadata). Skipped for
 *      non-default variants today since per-color photos are sufficient.
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
    console.log("[blank-mockup] per-variant: cache hit", {
      variantId,
      productType,
      url: cached.mockup_url,
    });
    return cached as BlankMockupRow;
  }

  const cfg = getCatalogConfig(productType);
  const isDefaultVariant = cfg?.catalogVariantId === variantId;

  /** Track A: per-color catalog photo. Works for any variant. */
  let trackA = await generateBlankFromCatalogPhoto(variantId, productType).catch((err) => {
    console.warn("[blank-mockup] per-variant: Track A threw", {
      variantId,
      productType,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  });

  /**
   * Track B fallback. Only attempted for the env-default variant (where we
   * have a guaranteed-valid catalog config for the mockup-tasks job). Non-
   * default variants without a catalog photo stay uncached and fall back to
   * the SVG silhouette client-side — better than spamming mockup-tasks for
   * every missing color.
   */
  if (!trackA && isDefaultVariant) {
    const trackB = await generateFlatBlankMockup(productType).catch((err) => {
      console.warn("[blank-mockup] per-variant: Track B threw", {
        variantId,
        productType,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    });
    if (trackB) {
      trackA = {
        result: trackB,
        colorName: opts?.colorName ?? null,
        colorHex: opts?.colorHex ?? null,
      };
    }
  }

  if (!trackA) return null;

  const px = trackA.result.printAreaPx;
  const row: BlankMockupRow = {
    product_type: productType,
    mockup_url: trackA.result.url,
    catalog_product_id: trackA.result.catalogProductId,
    catalog_variant_id: trackA.result.catalogVariantId,
    mockup_style_id: trackA.result.mockupStyleId || null,
    technique: cfg?.technique ?? null,
    placement: cfg?.placement ?? null,
    print_area_width_in: trackA.result.printArea?.width ?? null,
    print_area_height_in: trackA.result.printArea?.height ?? null,
    color_name: opts?.colorName ?? trackA.colorName ?? null,
    color_hex: opts?.colorHex ?? trackA.colorHex ?? null,
    source: trackA.result.mockupStyleId ? "mockup_task" : "catalog_image",
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
