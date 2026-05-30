/**
 * Take-home math for the post-publish price editor.
 *
 * Money is in integer **cents** everywhere. The display layer should call
 * `formatUsd` (see `./format`) — never divide or `toFixed` inline.
 *
 * The platform fee (Gamerhood cut) and Stripe processing fee are both charged
 * on the buyer-facing **listing price**, not on the wholesale cost. That makes
 * the "what's the minimum price to break even" question a tiny algebra problem
 * rather than a subtraction:
 *
 *   takeHome = price − wholesale − shipping − stripeFee(price) − platformFee(price)
 *
 *   stripeFee(price)    = price · stripePct + stripeFixed
 *   platformFee(price)  = price · platformPct
 *
 *   Solve takeHome = 0:
 *     price · (1 − stripePct − platformPct) = wholesale + shipping + stripeFixed
 *     minPrice = (wholesale + shipping + stripeFixed) / (1 − stripePct − platformPct)
 *
 * That `minPrice` is the floor the server enforces and the UI surfaces.
 */

import {
  PLATFORM_FEE_PERCENT,
  STRIPE_FEE_PERCENT,
  STRIPE_FEE_FIXED_CENTS,
} from "@/lib/pricing/rates";

export interface CostInputs {
  itemWholesaleCents: number;
  shippingCents: number;
  /** Defaults to `PLATFORM_FEE_PERCENT` from pricing/rates.ts. */
  platformFeePercent?: number;
  /** Defaults to `STRIPE_FEE_PERCENT` (2.9). */
  stripeFeePercent?: number;
  /** Defaults to `STRIPE_FEE_FIXED_CENTS` (30). */
  stripeFixedFeeCents?: number;
}

export interface BaseCostBreakdown {
  itemCents: number;
  shippingCents: number;
  /** Platform fee evaluated AT the minimum (break-even) price. */
  platformCents: number;
  /** Stripe processing fee evaluated AT the minimum (break-even) price. */
  processingCents: number;
}

export interface BaseCostResult {
  /** Minimum allowed listing price (cents). Below this the creator loses money. */
  baseCostCents: number;
  breakdown: BaseCostBreakdown;
}

export interface TakeHomeBreakdown {
  itemCents: number;
  shippingCents: number;
  platformCents: number;
  processingCents: number;
}

export interface TakeHomeResult {
  takeHomeCents: number;
  breakdown: TakeHomeBreakdown;
}

function resolveRates(input: CostInputs) {
  const platformPct =
    typeof input.platformFeePercent === "number"
      ? input.platformFeePercent
      : PLATFORM_FEE_PERCENT;
  const stripePct =
    typeof input.stripeFeePercent === "number"
      ? input.stripeFeePercent
      : STRIPE_FEE_PERCENT;
  const stripeFixed =
    typeof input.stripeFixedFeeCents === "number"
      ? input.stripeFixedFeeCents
      : STRIPE_FEE_FIXED_CENTS;
  return { platformPct, stripePct, stripeFixed };
}

/**
 * The minimum listing price the creator can charge without losing money on
 * the sale, plus a breakdown of the four fee buckets evaluated at that floor.
 *
 * Rounds UP to the next whole cent so floating-point drift can never produce
 * a "looks fine" floor that the server rejects.
 */
export function computeBaseCost(input: CostInputs): BaseCostResult {
  const { platformPct, stripePct, stripeFixed } = resolveRates(input);
  const platform = platformPct / 100;
  const stripe = stripePct / 100;

  const fixedSum =
    Math.max(0, input.itemWholesaleCents) +
    Math.max(0, input.shippingCents) +
    Math.max(0, stripeFixed);

  const denom = 1 - platform - stripe;
  if (denom <= 0) {
    // Pathological config (combined % >= 100). Treat as "can't price profitably"
    // by returning a huge floor; the UI should still render a sensible error.
    return {
      baseCostCents: Number.POSITIVE_INFINITY,
      breakdown: {
        itemCents: input.itemWholesaleCents,
        shippingCents: input.shippingCents,
        platformCents: 0,
        processingCents: 0,
      },
    };
  }

  const rawMin = fixedSum / denom;
  const baseCostCents = Math.ceil(rawMin);

  return {
    baseCostCents,
    breakdown: {
      itemCents: input.itemWholesaleCents,
      shippingCents: input.shippingCents,
      platformCents: Math.round(baseCostCents * platform),
      processingCents: Math.round(baseCostCents * stripe) + stripeFixed,
    },
  };
}

/**
 * Solve for the listing price that puts the seller at `markupRatio` above
 * base cost — the publish-flow slider's "10% over what it costs to make
 * this thing" interpretation.
 *
 * `markupRatio` is the multiplier on the break-even price, so 0.10 means
 * "charge 10% more than base cost" → seller takes home roughly 10% of base
 * cost per sale (modulo the platform + Stripe percentages that scale with
 * the higher price). Clamped to [0, 10] so a runaway slider can't produce
 * a nonsense price.
 *
 * Rounds to the nearest whole cent. The caller is responsible for showing
 * a "near $0 take-home" warning at `markupRatio === 0`, and for snapping
 * the slider to integer percents.
 */
export function computePriceForMarkup(
  input: CostInputs & { markupRatio: number },
): number {
  const { baseCostCents } = computeBaseCost(input);
  if (!Number.isFinite(baseCostCents)) return baseCostCents;
  const ratio = Math.max(0, Math.min(10, input.markupRatio));
  return Math.round(baseCostCents * (1 + ratio));
}

/**
 * Inverse of `computePriceForMarkup` — given a listing price, what markup
 * ratio above base cost does the seller end up at? Used by the "type a
 * price directly" advanced toggle so the slider tracks the typed value.
 */
export function computeMarkupForPrice(
  input: CostInputs & { priceCents: number },
): number {
  const { baseCostCents } = computeBaseCost(input);
  if (!Number.isFinite(baseCostCents) || baseCostCents <= 0) return 0;
  return Math.max(0, (input.priceCents - baseCostCents) / baseCostCents);
}

/**
 * Take-home at a specific entered listing price. Negative values mean the
 * creator would lose money — surface this in the UI and refuse on the server.
 */
export function computeTakeHome(
  input: CostInputs & { priceCents: number },
): TakeHomeResult {
  const { platformPct, stripePct, stripeFixed } = resolveRates(input);
  const platform = platformPct / 100;
  const stripe = stripePct / 100;

  const price = Math.max(0, Math.round(input.priceCents));
  const item = Math.max(0, input.itemWholesaleCents);
  const shipping = Math.max(0, input.shippingCents);

  const platformCents = Math.round(price * platform);
  const processingCents = Math.round(price * stripe) + stripeFixed;
  const takeHomeCents = price - item - shipping - platformCents - processingCents;

  return {
    takeHomeCents,
    breakdown: {
      itemCents: item,
      shippingCents: shipping,
      platformCents,
      processingCents,
    },
  };
}
