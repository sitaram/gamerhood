import type { ProductType } from "@/lib/types";
import type { PrintfulCatalogConfig } from "@/lib/printful/catalog";
import { getPrintAreaInches } from "@/lib/printful/catalog";

/** Saved on `products.print_placement`; imageAspect = width / height when known */
export interface StoredPrintPlacement {
  zoom: number;
  panX: number;
  panY: number;
  imageAspect: number;
}

/** 1 = "contain" the print rectangle (artwork fits fully inside the print box). */
export const PLACEMENT_ZOOM_MIN = 0.3;
export const PLACEMENT_ZOOM_MAX = 2.5;
/**
 * Default uses `contain` semantics: at zoom = 1 the full artwork would touch
 * whichever axis matches the box aspect and leave slack on the other. We
 * default to 0.7 so the design lands at ~70 % of that contain size — small
 * enough that a square design on a 14×14 hoodie box renders at ~10" wide
 * (room around it for the garment to show through) rather than filling the
 * full chest from shoulder to shoulder.
 *
 * This matches Printful's own design-maker default behavior: it imports
 * uploaded art at a comfortable mid-chest size rather than stretching it
 * to fill the printable area. Creators can still drag the slider up to 1.0
 * to fill, or beyond 1.0 to crop.
 *
 * Stored placements on existing products keep their saved zoom value, so
 * this default only affects newly-created designs.
 */
export const PLACEMENT_ZOOM_DEFAULT = 0.7;

const DEFAULT_STORED: StoredPrintPlacement = {
  zoom: PLACEMENT_ZOOM_DEFAULT,
  panX: 0,
  panY: 0,
  imageAspect: 1,
};

export function parseStoredPlacement(raw: unknown): StoredPrintPlacement | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const zoom = typeof o.zoom === "number" && Number.isFinite(o.zoom) ? o.zoom : DEFAULT_STORED.zoom;
  const panX = typeof o.panX === "number" && Number.isFinite(o.panX) ? o.panX : 0;
  const panY = typeof o.panY === "number" && Number.isFinite(o.panY) ? o.panY : 0;
  const imageAspect =
    typeof o.imageAspect === "number" && Number.isFinite(o.imageAspect) && o.imageAspect > 0
      ? o.imageAspect
      : 1;
  return {
    zoom: Math.min(PLACEMENT_ZOOM_MAX, Math.max(PLACEMENT_ZOOM_MIN, zoom)),
    panX: Math.min(1, Math.max(-1, panX)),
    panY: Math.min(1, Math.max(-1, panY)),
    imageAspect,
  };
}

/** Printful v2 layer `position` (uses same length unit as placement print area — inches in API docs). */
export interface PrintfulLayerPosition {
  area_width: number;
  area_height: number;
  width: number;
  height: number;
  left: number;
  top: number;
}

export function normalizedPlacementToPrintful(opts: {
  areaWidthIn: number;
  areaHeightIn: number;
  placement: StoredPrintPlacement;
}): PrintfulLayerPosition {
  const { areaWidthIn: Aw, areaHeightIn: Ah, placement } = opts;
  const aspect = placement.imageAspect;
  const zw = Aw * 300;
  const zh = Ah * 300;

  /** Intrinsic image size in px (height = 300 for scale) */
  const ih = 300;
  const iw = ih * aspect;

  /**
   * Contain: at zoom=1 the artwork fits fully inside the print rectangle,
   * touching the matching-aspect axis and leaving slack on the other. This
   * guarantees the slack-axis pan in [-1, 1] always has range (e.g. a square
   * 1024×1024 design on a 12×15 hoodie box gets 3" of vertical slack), and
   * matches the "you see your whole design at default" expectation creators
   * have. Zooming past 1 overflows both axes ⇒ both pan axes have range.
   */
  let w = zw;
  let h = w / aspect;
  if (h > zh) {
    h = zh;
    w = h * aspect;
  }

  w *= placement.zoom;
  h *= placement.zoom;

  /**
   * `panX`/`panY` ∈ [-1, 1] should always be able to push the artwork to
   * the corresponding edge of the print box. We size each pan step to half
   * the available slack so pan=±1 lands exactly on the edge — whether the
   * artwork is bigger than the box (cropping/repositioning a cover) or
   * smaller (free-floating inside the box).
   */
  const slackX = zw - w;
  const slackY = zh - h;
  let left = slackX / 2 + placement.panX * (Math.abs(slackX) / 2);
  let top = slackY / 2 + placement.panY * (Math.abs(slackY) / 2);

  /**
   * When w > zw the artwork overflows: left ∈ [zw-w, 0].
   * When w < zw the artwork floats: left ∈ [0, zw-w].
   * Compute the inclusive range either way so smaller zooms aren't pinned
   * to one edge.
   */
  const loL = Math.min(0, slackX);
  const hiL = Math.max(0, slackX);
  const loT = Math.min(0, slackY);
  const hiT = Math.max(0, slackY);
  left = Math.max(loL, Math.min(hiL, left));
  top = Math.max(loT, Math.min(hiT, top));

  return {
    area_width: Aw,
    area_height: Ah,
    width: (w / zw) * Aw,
    height: (h / zh) * Ah,
    left: (left / zw) * Aw,
    top: (top / zh) * Ah,
  };
}

export function placementLayerForProduct(
  productType: ProductType,
  catalog: Pick<PrintfulCatalogConfig, "technique"> | null,
  stored: StoredPrintPlacement | null,
): PrintfulLayerPosition | null {
  if (!stored || !catalog) return null;
  if (!supportsCustomPlacement(catalog)) return null;
  const area = getPrintAreaInches(productType);
  if (!area) return null;
  return normalizedPlacementToPrintful({
    areaWidthIn: area.width,
    areaHeightIn: area.height,
    placement: stored,
  });
}

export function supportsCustomPlacement(config: Pick<PrintfulCatalogConfig, "technique">): boolean {
  return config.technique === "dtg" || config.technique === "dtfilm";
}

/** Merge batch default framing with optional per–product-type overrides (create flow / dashboard). */
export function placementForProductType(
  master: StoredPrintPlacement,
  overrides: Partial<Record<string, StoredPrintPlacement>> | undefined,
  productType: string,
): StoredPrintPlacement {
  const o = overrides?.[productType];
  return o ?? master;
}

export { DEFAULT_STORED };
