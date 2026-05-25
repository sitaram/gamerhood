/**
 * Pick the cost basis to feed into the take-home math for a given listing.
 *
 * Order of precedence:
 *   1. The values persisted on the `products` row at publish time
 *      (`wholesale_price_cents` / `shipping_estimate_cents`). These are the
 *      stable, contract-with-the-creator numbers.
 *   2. Per-product-type defaults from `getDefaultProductCostBasis` for the
 *      legacy rows published before the cost columns existed.
 *
 * Returns a `source` so the UI can disclose when the floor is computed from
 * a default rather than the listing's own persisted values.
 */

import { getDefaultProductCostBasis } from "@/lib/pricing/product-costs";

export interface ResolvedCostBasis {
  wholesaleCents: number;
  shippingCents: number;
  source: "persisted" | "default";
}

export function resolveCostBasis(args: {
  productType: string;
  wholesalePriceCents: number | null | undefined;
  shippingEstimateCents: number | null | undefined;
}): ResolvedCostBasis {
  const fallback = getDefaultProductCostBasis(args.productType);
  const wholesale =
    typeof args.wholesalePriceCents === "number" && args.wholesalePriceCents >= 0
      ? args.wholesalePriceCents
      : null;
  const shipping =
    typeof args.shippingEstimateCents === "number" && args.shippingEstimateCents >= 0
      ? args.shippingEstimateCents
      : null;

  if (wholesale !== null && shipping !== null) {
    return {
      wholesaleCents: wholesale,
      shippingCents: shipping,
      source: "persisted",
    };
  }

  return {
    wholesaleCents: wholesale ?? fallback.wholesaleCents,
    shippingCents: shipping ?? fallback.shippingCents,
    source: "default",
  };
}
