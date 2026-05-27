import type { ProductType } from "@/lib/types";

/**
 * Visual template for "art on actual merch" in the create flow.
 *
 * IMPORTANT — these values are FALLBACK ONLY for the *garment-on-photo*
 * framing (where the chest sits within the rendered photo). They were
 * hand-calibrated against Printful's env-default flat mockup style for
 * each product type. They are NOT the print area in inches — that comes
 * from `printful_blank_mockups.print_area_{width,height}_in` (migration
 * 023) via `usePrintfulBlankPhoto().area` or
 * `getDefaultPrintAreaInches()`.
 *
 * Every surface that composites a design over a garment photo MUST flow
 * through `computeDesignOverlayBox` in `src/lib/print/overlay-geometry.ts`
 * so the design size always reflects the live Printful print area, even
 * when this `photoBand` block is out of date. Do not re-introduce per-
 * surface arithmetic against `printMaxWidthPct` outside that helper.
 */
export type MerchPreviewLayout = {
  /** When false, show the legacy full-bleed print rectangle only. */
  showGarment: boolean;
  /** Garment card width ÷ height. */
  garmentAspect: number;
  /** Top inset for the band where we center the print (% of garment height). */
  printBandTopPct: number;
  /** Bottom inset for that band (%). */
  printBandBottomPct: number;
  /** Max width of print zone vs garment width (%). */
  printMaxWidthPct: number;
  /**
   * When set together, the print band is a horizontal strip at this offset/width (for leg/side prints).
   * Omit for centered chest prints across full garment width.
   */
  printBandLeftPct?: number;
  printBandWidthPct?: number;
  /**
   * Override applied when a real Printful flat product mockup is the backdrop.
   * Flat photos frame the garment ~80–95 % of frame width (no model, no
   * outstretched sleeves) so the chest band is wider + slightly higher than
   * the silhouette tune that has to leave room for jutting sleeves.
   *
   * Printful's mockup-tasks output is square (1200×1200), so we also override
   * `garmentAspect` to 1 — otherwise the photo letterboxes inside the
   * silhouette-shaped container and the print band drifts off the chest.
   * Omit per type to inherit the silhouette values.
   */
  photoBand?: Partial<{
    garmentAspect: number;
    printBandTopPct: number;
    printBandBottomPct: number;
    printMaxWidthPct: number;
    printBandLeftPct: number;
    printBandWidthPct: number;
  }>;
};

export function getMerchPreviewLayout(productType: ProductType): MerchPreviewLayout {
  switch (productType) {
    /** Chest print sits on the torso — keep clear of the hood/yoke in the SVG. */
    case "hoodie":
      return {
        showGarment: true,
        /**
         * Matches `MerchGarmentSilhouette` hoodie viewBox (140×152) which includes
         * outstretched sleeves; body itself is ~46% of frame width, so the chest
         * print box is sized to ~55% of body width and lands above the pocket.
         */
        garmentAspect: 140 / 152,
        printBandTopPct: 45,
        printBandBottomPct: 22,
        printMaxWidthPct: 25,
        /**
         * Flat Printful mockup (1200×1200, Gildan 18500, mockup style 1563
         * "Flat 2" = sleeves spread outward / T-pose). Tuned to mirror what
         * Printful's own design maker draws on top of this same photo:
         *   - Hood/yoke seam lands around y ≈ 38 %; pocket top around y ≈ 70 %.
         *   - Garment body (sleeves excluded) ≈ 52 % of frame width;
         *     Gildan 18500 `front` print area = 14×14" on a ~22" chest =
         *     ~64 % of body = ~33 % of frame.
         * Print area is now square (was 12×15), so we widen the band and
         * pull the bottom up — the box sits right under the yoke and stops
         * above the kangaroo pocket, matching the reference Printful UI.
         */
        photoBand: {
          garmentAspect: 1,
          printBandTopPct: 38,
          printBandBottomPct: 30,
          printMaxWidthPct: 33,
        },
      };
    case "kids-hoodie":
      return {
        showGarment: true,
        garmentAspect: 140 / 152,
        printBandTopPct: 44,
        printBandBottomPct: 24,
        printMaxWidthPct: 26,
        /**
         * Kids hoodie shares the "Flat 2" framing convention; print area is
         * smaller (10×12" vs adult 14×14") so the band is narrower and the
         * box is more upright.
         */
        photoBand: {
          garmentAspect: 1,
          printBandTopPct: 36,
          printBandBottomPct: 32,
          printMaxWidthPct: 28,
        },
      };
    case "tshirt":
    case "kids-tshirt":
    case "kids-heavyweight-tee":
    case "kids-sports-tee":
      return {
        showGarment: true,
        garmentAspect: 100 / 118,
        printBandTopPct: 30,
        printBandBottomPct: 30,
        printMaxWidthPct: 50,
        /**
         * Bella+Canvas 3001 Flat 2 photo. Tee body ≈ 50 % of frame width;
         * 12" `front` print area on a ~20" chest = ~60 % of body = ~30 %
         * of frame. Box is tall (12×16, 0.75 aspect) so it extends from
         * just below the collar down to roughly the bottom hem.
         */
        photoBand: {
          garmentAspect: 1,
          printBandTopPct: 24,
          printBandBottomPct: 28,
          printMaxWidthPct: 30,
        },
      };
    case "kids-long-sleeve":
      return {
        showGarment: true,
        garmentAspect: 100 / 124,
        printBandTopPct: 30,
        printBandBottomPct: 28,
        printMaxWidthPct: 48,
        photoBand: {
          garmentAspect: 1,
          printBandTopPct: 24,
          printBandBottomPct: 32,
          printMaxWidthPct: 28,
        },
      };
    case "joggers":
      return {
        showGarment: true,
        garmentAspect: 108 / 100,
        printBandTopPct: 34,
        printBandBottomPct: 14,
        printMaxWidthPct: 88,
        printBandLeftPct: 10,
        printBandWidthPct: 34,
      };
    case "mug":
      return {
        showGarment: true,
        garmentAspect: 120 / 100,
        printBandTopPct: 18,
        printBandBottomPct: 28,
        printMaxWidthPct: 48,
      };
    case "backpack":
      return {
        showGarment: true,
        garmentAspect: 100 / 118,
        printBandTopPct: 26,
        printBandBottomPct: 36,
        printMaxWidthPct: 46,
      };
    case "poster":
      return {
        showGarment: true,
        garmentAspect: 10 / 16,
        printBandTopPct: 12,
        printBandBottomPct: 18,
        printMaxWidthPct: 72,
      };
    case "pillow":
      return {
        showGarment: true,
        garmentAspect: 11 / 10,
        printBandTopPct: 18,
        printBandBottomPct: 22,
        printMaxWidthPct: 58,
      };
    case "blanket":
      return {
        showGarment: true,
        garmentAspect: 16 / 11,
        printBandTopPct: 22,
        printBandBottomPct: 32,
        printMaxWidthPct: 68,
      };
    case "pet-sweater":
      return {
        showGarment: true,
        garmentAspect: 11 / 8,
        printBandTopPct: 28,
        printBandBottomPct: 40,
        printMaxWidthPct: 44,
      };
    case "tote-bag":
      return {
        showGarment: true,
        garmentAspect: 100 / 120,
        printBandTopPct: 26,
        printBandBottomPct: 32,
        printMaxWidthPct: 50,
      };
    case "sticker":
      return {
        showGarment: true,
        garmentAspect: 1,
        printBandTopPct: 16,
        printBandBottomPct: 16,
        printMaxWidthPct: 64,
      };
    case "phone-case":
      return {
        showGarment: true,
        garmentAspect: 10 / 20,
        printBandTopPct: 26,
        printBandBottomPct: 30,
        printMaxWidthPct: 52,
      };
    case "ornament":
      return {
        showGarment: true,
        garmentAspect: 1,
        printBandTopPct: 34,
        printBandBottomPct: 36,
        printMaxWidthPct: 40,
      };
    case "puzzle":
      return {
        showGarment: true,
        garmentAspect: 11 / 14,
        printBandTopPct: 14,
        printBandBottomPct: 16,
        printMaxWidthPct: 78,
      };
    case "embroidered-patch":
      return {
        showGarment: true,
        garmentAspect: 1,
        printBandTopPct: 22,
        printBandBottomPct: 22,
        printMaxWidthPct: 62,
      };
    case "hardcover-journal":
      return {
        showGarment: true,
        garmentAspect: 17 / 10,
        printBandTopPct: 20,
        printBandBottomPct: 24,
        printMaxWidthPct: 86,
      };
  }
  /**
   * Defensive fallback for any product type that hasn't been added to the
   * switch yet (or for legacy rows whose `product_type` isn't in the
   * current `ProductType` union). The previous implicit `undefined` return
   * crashed callers like `MerchPlacementPreview` during SSR — far worse
   * than rendering a generic frameless preview.
   */
  return {
    showGarment: false,
    garmentAspect: 1,
    printBandTopPct: 12,
    printBandBottomPct: 12,
    printMaxWidthPct: 80,
  };
}
