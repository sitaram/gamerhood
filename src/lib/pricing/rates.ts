/**
 * Single source of truth for the platform + payment-processor rates used
 * across the take-home math, the price editor UI, the FAQ copy, and the
 * checkout fee calculator.
 *
 * Lives in its own file (no Stripe SDK imports) so client components can
 * pull these constants without dragging server-only code into the browser
 * bundle. `src/lib/stripe/client.ts` re-exports the same names for code
 * paths that also need the SDK.
 */

/** Gamerhood's cut, as a percent (8 means 8%). */
export const PLATFORM_FEE_PERCENT = Number(
  process.env.STRIPE_PLATFORM_FEE_PERCENT || "8",
);

/**
 * Stripe's standard US online card rate. Percentage portion only — the per-
 * transaction fixed fee is `STRIPE_FEE_FIXED_CENTS`.
 */
export const STRIPE_FEE_PERCENT = Number(
  process.env.STRIPE_FEE_PERCENT || "2.9",
);
export const STRIPE_FEE_FIXED_CENTS = Number(
  process.env.STRIPE_FEE_FIXED_CENTS || "30",
);
