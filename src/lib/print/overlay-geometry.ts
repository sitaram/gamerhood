/**
 * Single source of truth for "where does the design sit on the garment photo".
 *
 * Every surface that composites a design over a garment image (placement
 * editor, MerchPlacementPreview, PhotographicColorMockup, cart thumb, listing
 * edit thumb) MUST funnel through `computeDesignOverlayBox`. The hand-tuned
 * `photoBand` from `merch-preview-layout.ts` provides the per-garment framing
 * (where the chest sits on the photo); the print area in inches comes from
 * Printful's `placement_dimensions` cached on `printful_blank_mockups` and
 * is the authoritative size — so the rendered overlay always reflects what
 * Printful will actually print.
 *
 * Why this exists:
 *   Before unification each surface ran its own arithmetic against
 *   `getPrintAreaInches()` (env defaults), and the placement editor's
 *   per-variant `liveArea` override was applied inconsistently. That made
 *   it possible for the editor to draw the design at 14×14 while the PDP
 *   drew the same listing at 12×15 because the editor was the only caller
 *   reading the DB-cached dims. This helper closes the gap.
 */
import type { ProductType } from "@/lib/types";
import type { StoredPrintPlacement } from "@/lib/print/placement";
import { normalizedPlacementToPrintful } from "@/lib/print/placement";
import { getPrintAreaInches } from "@/lib/printful/catalog";

/** Photo-framing layout from `getMerchPreviewLayout(productType)`. */
export interface PhotoBandLayout {
  /** % distance from each photo edge to the print band. */
  printBandTopPct: number;
  printBandBottomPct: number;
  /**
   * Default-tuned width of the print band on the photo, as % of frame width.
   * For chest prints this band is centred; for joggers (side print) it pairs
   * with `printBandLeftPct` / `printBandWidthPct`.
   */
  printMaxWidthPct: number;
  /** Set TOGETHER for side prints (e.g. joggers leg). */
  printBandLeftPct?: number;
  printBandWidthPct?: number;
}

/**
 * `printAreaInches` is the per-variant Printful dimensions (DB cache);
 * `defaultPrintAreaInches` is the hardcoded fallback that the photoBand
 * was visually calibrated against — used to scale the band width when the
 * live dims differ from the default (e.g. when env points at a smaller
 * size variant).
 */
export interface OverlayInput {
  productType: ProductType;
  layout: PhotoBandLayout;
  printAreaInches: { width: number; height: number } | null;
  defaultPrintAreaInches: { width: number; height: number } | null;
  normalizedPlacement: StoredPrintPlacement;
  /**
   * Optional garment frame size in pixels (when the caller knows it from
   * the rendered image dims). When provided, the design's absolute pixel
   * size + the inches→pixels ratio are exposed alongside the percentage
   * outputs so the dev-only sanity logger can verify the conversion.
   */
  garmentPhotoSize?: { widthPx: number; heightPx: number } | null;
  /**
   * Optional physical garment chest width in inches (from Printful's
   * catalog). When known we can derive the band width purely from
   * geometry (W_print / W_garment) — until then we scale the photoBand-
   * calibrated default by the ratio of live-to-default print area.
   */
  garmentWidthInches?: number | null;
}

export interface ComputedOverlay {
  /** Where the print band sits ON the garment photo (% of frame). */
  band: {
    topPct: number;
    bottomPct: number;
    /** Set together with `widthPct` for side prints; else `widthPct` only. */
    leftPct: number | null;
    widthPct: number;
    /** CSS `aspect-ratio` string in inches space (e.g. "14 / 14"). */
    aspectRatio: string;
  };
  /** Where the design sits inside the print band (% of band). */
  design: {
    widthPct: number;
    heightPct: number;
    leftPct: number;
    topPct: number;
  };
  /**
   * Physical dimensions in inches — used by the creator-facing print-size
   * indicator and by the pre-payment drift safeguard.
   */
  designInches: { width: number; height: number };
  printAreaInches: { width: number; height: number };
  /**
   * Where the print area dims came from. `printful-cache` is the
   * authoritative path; `default` indicates we fell back to the hardcoded
   * env defaults (legacy variants pre-migration 023, or a brand-new
   * product type not yet warmed).
   */
  printAreaSource: "printful-cache" | "default";
  /**
   * Convenience absolute-pixel values when `garmentPhotoSize` was passed.
   * Computed once in the helper so callers (debug logger, regression
   * script) don't have to re-do the percentage math.
   */
  designPixelSize: { widthPx: number; heightPx: number } | null;
  /** Inches → pixels ratio used; only populated when garment size known. */
  inchesPerPixel: number | null;
}

/**
 * Compute the rendered overlay box.
 *
 * The percentages returned plug straight into the existing CSS. Callers
 * render: garment photo at `object-contain` inside its frame; the band
 * div positioned with `top/bottom/left/width` from `overlay.band`; the
 * design div inside the band positioned with `overlay.design`.
 */
export function computeDesignOverlayBox(input: OverlayInput): ComputedOverlay {
  const fallback = input.defaultPrintAreaInches ?? { width: 12, height: 15 };
  const area = input.printAreaInches ?? fallback;
  const Aw = area.width;
  const Ah = area.height;

  const pf = normalizedPlacementToPrintful({
    areaWidthIn: Aw,
    areaHeightIn: Ah,
    placement: input.normalizedPlacement,
  });

  /**
   * Side-print SKUs (joggers leg) pin the band with absolute left/width;
   * chest prints centre it inside a `left-1 right-1` flex wrapper and only
   * need a max-width. We surface both so the caller picks the right CSS.
   */
  const isSidePrint =
    input.layout.printBandLeftPct != null && input.layout.printBandWidthPct != null;

  let bandWidthPct: number;
  if (isSidePrint) {
    bandWidthPct = input.layout.printBandWidthPct ?? input.layout.printMaxWidthPct;
  } else if (
    input.garmentWidthInches &&
    input.garmentWidthInches > 0 &&
    input.printAreaInches // only trust pure-geometry derivation when we have BOTH live values
  ) {
    /**
     * Pure-geometry path: print band width = (W_print / W_garment) * garment-fraction-of-frame.
     * We extract the garment-fraction-of-frame from photoBand by inverting:
     *   photoBand was tuned so `printMaxWidthPct = (defaultW_print / W_garment) * garmentFraction`.
     * So `garmentFraction = printMaxWidthPct * W_garment / defaultW_print`,
     * and the corrected width = `printMaxWidthPct * (W_print / defaultW_print)`.
     * Same answer as the live/default ratio scale below — the
     * garment-width input becomes load-bearing once we trust per-variant
     * garment widths to differ (different SKUs in the same product type).
     */
    const ratio = Aw / fallback.width;
    bandWidthPct = input.layout.printMaxWidthPct * ratio;
  } else {
    /**
     * Scale the photoBand-tuned default by ratio of live to default print
     * area width. Keeps the box visually correct when the env-default
     * variant uses 14×14 but the variant being rendered ships 12×15.
     */
    const ratio = input.printAreaInches ? Aw / fallback.width : 1;
    bandWidthPct = input.layout.printMaxWidthPct * ratio;
  }

  const designWidthPct = (pf.width / pf.area_width) * 100;
  const designHeightPct = (pf.height / pf.area_height) * 100;
  const designLeftPct = (pf.left / pf.area_width) * 100;
  const designTopPct = (pf.top / pf.area_height) * 100;

  /**
   * When the caller knows the photo's pixel size (placement editor + the
   * regression script do), we can compute the design's absolute pixel
   * size for the dev sanity logger. Photos render `object-contain`, so we
   * use the *frame* pixel size as the ceiling — the design's pixel size
   * is (band % * frame px) * (design % within band).
   */
  let designPixelSize: { widthPx: number; heightPx: number } | null = null;
  let inchesPerPixel: number | null = null;
  if (input.garmentPhotoSize) {
    const bandPx = (bandWidthPct / 100) * input.garmentPhotoSize.widthPx;
    /** Band is sized by aspect-ratio so heightPx derives from widthPx. */
    const bandHeightPx = bandPx * (Ah / Aw);
    const designWPx = (designWidthPct / 100) * bandPx;
    const designHPx = (designHeightPct / 100) * bandHeightPx;
    designPixelSize = { widthPx: designWPx, heightPx: designHPx };
    inchesPerPixel = pf.width / Math.max(1, designWPx);
  }

  return {
    band: {
      topPct: input.layout.printBandTopPct,
      bottomPct: input.layout.printBandBottomPct,
      leftPct: isSidePrint ? input.layout.printBandLeftPct ?? null : null,
      widthPct: bandWidthPct,
      aspectRatio: `${Aw} / ${Ah}`,
    },
    design: {
      widthPct: designWidthPct,
      heightPct: designHeightPct,
      leftPct: designLeftPct,
      topPct: designTopPct,
    },
    designInches: { width: pf.width, height: pf.height },
    printAreaInches: { width: Aw, height: Ah },
    printAreaSource: input.printAreaInches ? "printful-cache" : "default",
    designPixelSize,
    inchesPerPixel,
  };
}

/**
 * Convenience: pull `defaultPrintAreaInches` from the env/hardcoded
 * fallback for the given productType. Most call sites already had this
 * tucked into a local — exporting it keeps the inputs consistent.
 */
export function getDefaultPrintAreaInches(
  productType: ProductType,
): { width: number; height: number } | null {
  return getPrintAreaInches(productType);
}

/**
 * Human-friendly "X.Xʺ × Y.Yʺ" string. Two decimals when needed, one
 * otherwise, so 4.0 reads as `4"` and 4.25 reads as `4.3"`. Used by the
 * creator-facing print-size indicator.
 */
export function formatInchesLabel(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
    return `${Math.round(rounded)}"`;
  }
  return `${rounded.toFixed(1)}"`;
}
