import type { ProductType } from "@/lib/types";

/**
 * Visual template for “art on actual merch” in the create flow.
 * Print box uses real Printful aspect (Aw/Ah); position is approximate on the garment.
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
         * "Flat 2" = sleeves spread outward / T-pose). Measured from the
         * actual rendered photo:
         *   - Hood/yoke ends around y≈28 %; pocket top around y≈66 %.
         *   - Torso (sleeves excluded) is ~52 % of frame wide. A 12 in.
         *     print on a ~22 in. chest is 55 % of body = ~28 % of frame,
         *     so we cap `printMaxWidthPct` at 24 % to leave a small margin.
         * The previous tuning (22 / 32 / 35) was for the "Flat" style with
         * sleeves tucked across the body — bumping the top up to 30 puts
         * the box right under the hood/yoke seam where chest prints land.
         */
        photoBand: {
          garmentAspect: 1,
          printBandTopPct: 30,
          printBandBottomPct: 35,
          printMaxWidthPct: 24,
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
         * Kids hoodie shares the same Gildan-style "Flat 2" framing
         * conventions; tuned to the same chest band as adult hoodie.
         */
        photoBand: {
          garmentAspect: 1,
          printBandTopPct: 30,
          printBandBottomPct: 36,
          printMaxWidthPct: 24,
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
         * Tee body fills ~50 % of the photo frame; 12 in. print on ~20 in.
         * chest ≈ 60 % of body = ~30 % of frame.
         */
        photoBand: {
          garmentAspect: 1,
          printBandTopPct: 26,
          printBandBottomPct: 35,
          printMaxWidthPct: 28,
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
          printBandTopPct: 26,
          printBandBottomPct: 36,
          printMaxWidthPct: 26,
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
}
