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

/** 1 = "contain" the print rectangle (artwork fits fully inside the print box).
 *  Floor is tiny so creators can place a small motif (e.g. a left-chest logo)
 *  rather than being forced to ~⅓ of the printable area. */
export const PLACEMENT_ZOOM_MIN = 0.05;
export const PLACEMENT_ZOOM_MAX = 2.5;

/**
 * Pan range allows intentional overhang past the print frame for "bleed"
 * crops. `|pan| <= 1` stays inside the natural slack (artwork edge touches
 * print-box edge at ±1, matching pre-overhang behavior so stored
 * placements roundtrip unchanged). `|pan|` in (1, 2] pushes the artwork
 * outside the print box by up to half the smaller of `box` or `design`
 * dimension per axis — Printful clips anything past the print area, which
 * is exactly the intentional crop effect creators want.
 */
export const PLACEMENT_PAN_MAX = 2;
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
    panX: Math.min(PLACEMENT_PAN_MAX, Math.max(-PLACEMENT_PAN_MAX, panX)),
    panY: Math.min(PLACEMENT_PAN_MAX, Math.max(-PLACEMENT_PAN_MAX, panY)),
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

function panToOffset(pan: number, slack: number, boxDim: number, designDim: number): number {
  const sign = Math.sign(pan);
  const absP = Math.min(PLACEMENT_PAN_MAX, Math.abs(pan));
  const inner = Math.min(1, absP);
  const outer = Math.max(0, absP - 1);
  const baseStep = Math.abs(slack) / 2;
  const overhangStep = Math.min(boxDim, designDim) / 2;
  return sign * (inner * baseStep + outer * overhangStep);
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
   * Pan-to-offset mapping is piecewise linear so existing placements
   * (created when pan was clamped to ±1) keep roundtripping at the same
   * pixel position:
   *   - `|pan| ≤ 1`: travel half the natural slack per unit, so pan=±1
   *     still parks the artwork exactly at the corresponding box edge
   *     (or, for `w > zw`, at the natural cover-crop limit).
   *   - `|pan|` in `(1, 2]`: add an overhang step equal to half of
   *     `min(boxDim, designDim)` per unit. That lets the user push the
   *     artwork outside the print box for an intentional bleed/crop —
   *     Printful clips anything past `[0, zw]` × `[0, zh]` when rendering.
   * The overhang step caps at `min(box, design) / 2` so at the maximum
   * pan the design always retains ≥ half of `min(box, design)` of overlap
   * with the print box — i.e. the user can never lose the design entirely
   * off-frame.
   */
  const slackX = zw - w;
  const slackY = zh - h;
  let left = slackX / 2 + panToOffset(placement.panX, slackX, zw, w);
  let top = slackY / 2 + panToOffset(placement.panY, slackY, zh, h);

  /**
   * Allowed range expanded to include the overhang region. For each axis,
   * the natural slack range (`[min(0,slack), max(0,slack)]`) is grown by
   * the overhang step on both sides, so any pan in [-2, 2] lands inside
   * the clamp.
   */
  const overhangX = Math.min(zw, w) / 2;
  const overhangY = Math.min(zh, h) / 2;
  const loL = Math.min(0, slackX) - overhangX;
  const hiL = Math.max(0, slackX) + overhangX;
  const loT = Math.min(0, slackY) - overhangY;
  const hiT = Math.max(0, slackY) + overhangY;
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
