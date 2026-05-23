import { printfulRequest } from "@/lib/printful/client";
import type { ProductType } from "@/lib/types";
import type { PrintfulCatalogMeta, PrintfulSizeGuideTable } from "@/lib/types";
import {
  apparelSizes,
  storefrontColors,
  MERCH_SIZED_TYPES,
} from "@/lib/merch/product-options";

function stripHtmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function readSizeCell(v: Record<string, unknown>): string {
  if (typeof v.value === "string" || typeof v.value === "number") return String(v.value);
  const min = v.min_value;
  const max = v.max_value;
  if (
    (typeof min === "string" || typeof min === "number") &&
    (typeof max === "string" || typeof max === "number")
  ) {
    return `${min}–${max}`;
  }
  return "";
}

function normalizeSizeTable(raw: Record<string, unknown>): PrintfulSizeGuideTable | null {
  const guideType = typeof raw.type === "string" ? raw.type : "unknown";
  const unit = typeof raw.unit === "string" ? raw.unit : "";
  const descRaw = typeof raw.description === "string" ? raw.description : "";
  const imgDescRaw = typeof raw.image_description === "string" ? raw.image_description : "";
  const imageUrl = typeof raw.image_url === "string" && raw.image_url ? raw.image_url : null;

  const measurements = raw.measurements;
  if (!Array.isArray(measurements)) return null;

  const rows: PrintfulSizeGuideTable["rows"] = [];

  for (const m of measurements) {
    const mr = asRecord(m);
    if (!mr) continue;
    const dimension = typeof mr.type_label === "string" ? mr.type_label : "—";
    const values = mr.values;
    if (!Array.isArray(values)) continue;
    const valuesBySize: Record<string, string> = {};
    for (const cell of values) {
      const cr = asRecord(cell);
      if (!cr) continue;
      const sz = typeof cr.size === "string" ? cr.size : "";
      if (!sz) continue;
      const disp = readSizeCell(cr);
      if (disp) valuesBySize[sz] = disp;
    }
    if (Object.keys(valuesBySize).length > 0) {
      rows.push({ dimension, valuesBySize });
    }
  }

  return {
    guideType,
    unit,
    introPlain: stripHtmlToPlain(descRaw),
    imageUrl,
    measurementHelpPlain: stripHtmlToPlain(imgDescRaw),
    rows,
  };
}

/** Prefer our size order when sizes overlap with Printful; otherwise use Printful list. */
export function intersectSizes(preferredOrder: string[], printfulAvailable: string[]): string[] {
  const avail = new Set(printfulAvailable);
  const ordered = preferredOrder.filter((s) => avail.has(s));
  if (ordered.length > 0) return ordered;
  return [...printfulAvailable];
}

export function colorNamesFromCatalog(colors: unknown): string[] | null {
  if (!Array.isArray(colors) || colors.length === 0) return null;
  const names: string[] = [];
  for (const c of colors) {
    const r = asRecord(c);
    if (!r || typeof r.name !== "string") continue;
    const n = r.name.trim();
    if (n && !names.includes(n)) names.push(n);
  }
  return names.length ? names : null;
}

export interface PrintfulPublishAugmentation {
  catalogProductId: number | null;
  meta: PrintfulCatalogMeta | null;
  sizes: string[] | null;
  colors: string[] | null;
}

/**
 * Loads catalog variant → product → size guide from Printful and returns fields to persist on `products`.
 */
export async function augmentMerchFromPrintfulCatalog(
  catalogVariantId: number,
  productType: ProductType,
): Promise<PrintfulPublishAugmentation | null> {
  try {
    const variantWrap = await printfulRequest<{ data: Record<string, unknown> }>(
      `/catalog-variants/${catalogVariantId}`,
    );
    const variant = variantWrap?.data;
    if (!variant || typeof variant.catalog_product_id !== "number") {
      return null;
    }

    const catalogProductId = variant.catalog_product_id;

    const [productWrap, sizesWrap] = await Promise.all([
      printfulRequest<{ data: Record<string, unknown> }>(`/catalog-products/${catalogProductId}`),
      printfulRequest<{ data: Record<string, unknown> }>(
        `/catalog-products/${catalogProductId}/sizes`,
      ).catch(() => ({ data: null as Record<string, unknown> | null })),
    ]);

    const product = productWrap?.data;
    const sizesRoot = sizesWrap?.data;

    const blankDescRaw =
      product && typeof product.description === "string" ? product.description : "";
    const blankDescription =
      blankDescRaw.includes("<") ? stripHtmlToPlain(blankDescRaw) : blankDescRaw.trim();

    const availableSizes = Array.isArray(sizesRoot?.available_sizes)
      ? sizesRoot.available_sizes.filter((s): s is string => typeof s === "string")
      : [];

    const rawTables = Array.isArray(sizesRoot?.size_tables) ? sizesRoot.size_tables : [];
    const sizeGuides: PrintfulSizeGuideTable[] = [];
    for (const t of rawTables.slice(0, 6)) {
      const tr = asRecord(t);
      if (!tr) continue;
      const normalized = normalizeSizeTable(tr);
      if (normalized) sizeGuides.push(normalized);
    }

    const catalogColors: PrintfulCatalogMeta["catalogColors"] = [];
    if (Array.isArray(product?.colors)) {
      for (const c of product.colors) {
        const r = asRecord(c);
        if (!r || typeof r.name !== "string") continue;
        catalogColors.push({
          name: r.name.trim(),
          hex: typeof r.value === "string" ? r.value : null,
        });
      }
    }

    const preferredSizes = apparelSizes(productType);
    let sizesOut: string[] | null = null;
    if (MERCH_SIZED_TYPES.has(productType)) {
      sizesOut =
        availableSizes.length > 0 ? intersectSizes(preferredSizes, availableSizes) : preferredSizes;
    }

    let colorsOut = colorNamesFromCatalog(product?.colors);
    if (!colorsOut?.length) {
      colorsOut = storefrontColors(productType);
    }

    const meta: PrintfulCatalogMeta = {
      fetchedAt: new Date().toISOString(),
      catalogProductId,
      catalogVariantId,
      productName:
        product && typeof product.name === "string"
          ? product.name
          : typeof variant.name === "string"
            ? variant.name
            : "Printful product",
      brand: product && typeof product.brand === "string" ? product.brand : null,
      model: product && typeof product.model === "string" ? product.model : null,
      printfulType: product && typeof product.type === "string" ? product.type : null,
      blankDescription: blankDescription.slice(0, 12000),
      availableSizes,
      catalogColors,
      sizeGuides,
    };

    return {
      catalogProductId,
      meta,
      sizes: sizesOut,
      colors: colorsOut,
    };
  } catch (err) {
    console.warn("[Printful catalog] Could not load catalog snapshot:", err);
    return null;
  }
}
