import Stripe from "stripe";

import {
  PLATFORM_FEE_PERCENT,
  STRIPE_FEE_PERCENT,
  STRIPE_FEE_FIXED_CENTS,
} from "@/lib/pricing/rates";

let _stripe: Stripe | null = null;

function readStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key) return "";
  if (key.includes("...") || /^sk_(test|live)_$/i.test(key)) return "";
  return key;
}

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = readStripeSecretKey();
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  }
  return _stripe;
}

// Re-export the rate constants so existing call sites that import from
// `@/lib/stripe/client` keep working. New client-side code should import
// directly from `@/lib/pricing/rates` to avoid pulling the Stripe SDK into
// the browser bundle.
export { PLATFORM_FEE_PERCENT, STRIPE_FEE_PERCENT, STRIPE_FEE_FIXED_CENTS };

export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}
