import Stripe from "stripe";

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

export const PLATFORM_FEE_PERCENT = Number(
  process.env.STRIPE_PLATFORM_FEE_PERCENT || "8",
);

export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}
