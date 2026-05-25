/**
 * Per-product-type cost basis defaults.
 *
 * These are conservative US-domestic estimates derived from Printful's published
 * wholesale + standard-shipping prices for the default catalog variant of each
 * product type (see `src/lib/printful/catalog.ts` for the variant mapping).
 *
 * Real numbers vary by size, color, and shipping zone — at publish time we try
 * to fetch live prices and persist them per-listing on `products.wholesale_price_cents`
 * + `products.shipping_estimate_cents`. These defaults are the fallback when:
 *
 *   1. Printful's API isn't reachable from the publish handler (best-effort).
 *   2. The listing is a legacy row that was published before the cost columns
 *      existed and the lazy backfill in the editor hasn't filled them yet.
 *
 * Numbers are in cents. Re-check against Printful pricing once a quarter and
 * bump these if Printful raises its catalog prices — the take-home math reads
 * straight from here so a stale value would silently let creators list below
 * the real break-even price.
 */

import type { ProductType } from "@/lib/types";

interface ProductCostBasis {
  /** What Printful charges us to produce one unit (worst-case across sizes). */
  wholesaleCents: number;
  /** US standard-shipping cost for the first unit in an order. */
  shippingCents: number;
}

const COST_BASIS: Record<ProductType, ProductCostBasis> = {
  hoodie: { wholesaleCents: 2799, shippingCents: 599 },
  "kids-hoodie": { wholesaleCents: 2299, shippingCents: 599 },
  "kids-heavyweight-tee": { wholesaleCents: 1599, shippingCents: 449 },
  "kids-long-sleeve": { wholesaleCents: 1449, shippingCents: 449 },
  "kids-sports-tee": { wholesaleCents: 1199, shippingCents: 449 },
  "kids-tshirt": { wholesaleCents: 1199, shippingCents: 449 },
  tshirt: { wholesaleCents: 1299, shippingCents: 449 },
  joggers: { wholesaleCents: 2999, shippingCents: 599 },
  mug: { wholesaleCents: 799, shippingCents: 549 },
  poster: { wholesaleCents: 799, shippingCents: 499 },
  sticker: { wholesaleCents: 199, shippingCents: 349 },
  pillow: { wholesaleCents: 1499, shippingCents: 549 },
  blanket: { wholesaleCents: 2999, shippingCents: 699 },
  "pet-sweater": { wholesaleCents: 2199, shippingCents: 599 },
  backpack: { wholesaleCents: 2999, shippingCents: 599 },
  "phone-case": { wholesaleCents: 1199, shippingCents: 399 },
  "tote-bag": { wholesaleCents: 899, shippingCents: 449 },
  ornament: { wholesaleCents: 599, shippingCents: 449 },
  puzzle: { wholesaleCents: 1499, shippingCents: 549 },
  "embroidered-patch": { wholesaleCents: 499, shippingCents: 349 },
  "hardcover-journal": { wholesaleCents: 1499, shippingCents: 549 },
};

const FALLBACK: ProductCostBasis = { wholesaleCents: 1500, shippingCents: 499 };

/**
 * Always returns a result so the price editor can render even for unknown
 * product types — keeps the UI honest about the floor rather than silently
 * dropping to $0.
 */
export function getDefaultProductCostBasis(
  productType: string,
): ProductCostBasis {
  return (COST_BASIS as Record<string, ProductCostBasis>)[productType] ?? FALLBACK;
}

export type { ProductCostBasis };
