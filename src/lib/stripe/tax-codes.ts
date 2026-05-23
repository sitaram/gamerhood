import type { ProductType } from "@/lib/types";

/**
 * Stripe product tax codes by merch type.
 *
 * Apparel codes (txcd_30070...) automatically trigger state-specific
 * exemptions when Stripe Tax is enabled: NY exempts apparel under $110,
 * PA exempts apparel entirely, MA exempts under $175, etc. General-purpose
 * "tangible goods" code (txcd_99999999) is used for everything else; states
 * tax those at the standard rate.
 *
 * Source: https://docs.stripe.com/tax/tax-codes
 */
export const TAX_CODE_BY_TYPE: Record<ProductType, string> = {
  tshirt: "txcd_30070001", // Apparel - shirts
  hoodie: "txcd_30070001", // Apparel - shirts/hoodies
  "kids-hoodie": "txcd_30070001", // Youth fleece hoodie — garment tax handled like apparel where applicable
  "kids-long-sleeve": "txcd_30070001", // Youth long sleeve tee — apparel shirt family
  "kids-heavyweight-tee": "txcd_30070001", // Youth heavyweight tee — apparel shirt family
  "kids-tshirt": "txcd_30070001", // Youth tee — apparel shirt family
  "kids-sports-tee": "txcd_30070001", // Youth performance / sports tee — apparel shirt family
  joggers: "txcd_30070003", // Apparel - pants
  mug: "txcd_99999999", // Tangible goods - general
  poster: "txcd_99999999",
  sticker: "txcd_99999999",
  pillow: "txcd_99999999",
  blanket: "txcd_99999999",
  "pet-sweater": "txcd_99999999",
  backpack: "txcd_99999999",
  "tote-bag": "txcd_99999999",
  "phone-case": "txcd_99999999",
  ornament: "txcd_99999999",
  puzzle: "txcd_99999999",
  "embroidered-patch": "txcd_99999999",
  "hardcover-journal": "txcd_99999999",
};

/**
 * Whether to enable Stripe Tax on checkout sessions. Flip this on once the
 * platform is registered with at least one state's tax authority AND the
 * Stripe Tax product is enabled in the Dashboard (Settings → Tax). Off by
 * default so Phase 1 (sub-nexus) accounts don't accidentally start
 * collecting tax they're not registered for.
 */
export function isAutomaticTaxEnabled(): boolean {
  const flag = process.env.STRIPE_AUTOMATIC_TAX;
  return flag === "1" || flag?.toLowerCase() === "true";
}
