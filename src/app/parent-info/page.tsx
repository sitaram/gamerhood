import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Lock,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PLATFORM_FEE_PERCENT,
  STRIPE_FEE_FIXED_CENTS,
  STRIPE_FEE_PERCENT,
} from "@/lib/pricing/rates";

export const metadata: Metadata = {
  title: "Set up payouts for your kid — Gamerhood",
  description:
    "A short primer for parents and guardians: what Gamerhood is, why we need an adult to set up payouts, and what Stripe will ask for.",
  /**
   * Parents reach this page via a private link from their kid. Bake a
   * `noindex` into the meta + the response so the URL doesn't show up in
   * search results — the `next=` Stripe link is a single-use credential
   * that should never be cached publicly.
   */
  robots: { index: false, follow: false },
};

/**
 * `noindex` headers + dynamic-rendering opt-out: this page reads
 * `searchParams` (the per-link `next=` Stripe URL) so it's already
 * dynamic. Force-dynamic keeps the dev/build behavior obvious — never
 * statically prerender this primer.
 */
export const dynamic = "force-dynamic";

/**
 * Only allow redirects to the official Stripe Connect onboarding host —
 * a parent who scans a kid's QR code should never be punted off to an
 * arbitrary URL just because someone hand-crafted `?next=`.
 *
 * Stripe always serves account links from `connect.stripe.com`. We
 * accept that exact host (no subdomain wildcard) so a typo like
 * `connect-stripe.com` or `evil.com` falls through to the generic
 * fallback CTA.
 */
function safeStripeNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (parsed.host !== "connect.stripe.com") return null;
  return parsed.toString();
}

interface ParentInfoSearchParams {
  next?: string | string[];
}

export default async function ParentInfoPage({
  searchParams,
}: {
  searchParams: Promise<ParentInfoSearchParams>;
}) {
  const { next } = await searchParams;
  const rawNext = Array.isArray(next) ? next[0] : next;
  const stripeUrl = safeStripeNext(rawNext);

  const platformFeeLabel = `${PLATFORM_FEE_PERCENT}%`;
  const stripeFeeLabel = `${STRIPE_FEE_PERCENT}% + ${STRIPE_FEE_FIXED_CENTS}¢`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Welcome — your kid wants to start selling on Gamerhood
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          Quick primer before we hand you off to Stripe. Takes about 60 seconds to read.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Card className="border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <HelpCircle className="h-4 w-4 text-primary" aria-hidden="true" />
            What is Gamerhood?
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Print-on-demand merch — T-shirts, hoodies, mugs, stickers — designed
            by kids and teens. Powered by{" "}
            <span className="font-medium text-foreground">Printful</span>, who
            handles the actual printing and shipping. Family-friendly content
            moderation on every design.
          </p>
        </Card>

        <Card className="border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Why are you here?
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Federal law (and Stripe&apos;s identity-verification rules) means an
            adult has to set up payouts. Your kid can design and publish their
            shop on their own — you control where the money lands.
          </p>
        </Card>

        <Card className="border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="h-4 w-4 text-primary" aria-hidden="true" />
            What we&apos;ll ask you for
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Identity info (date of birth, SSN) plus a US bank account.{" "}
            <span className="font-medium text-foreground">Stripe</span> — not
            Gamerhood — collects and stores this. We never see your SSN or bank
            details. This is the same standard any selling platform uses
            (Etsy, Shopify, eBay, etc.).
          </p>
        </Card>

        <Card className="border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
            What happens after
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Money from your kid&apos;s sales lands in your bank account on a
            regular Stripe payout schedule. You can see all earnings on the
            dashboard. We charge a {platformFeeLabel} platform fee plus
            Stripe&apos;s standard {stripeFeeLabel} per sale.{" "}
            <Link
              href="/faq#pricing"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Why these fees?
            </Link>
          </p>
        </Card>
      </div>

      <div className="mt-10 rounded-xl border border-primary/30 bg-primary/5 p-6 text-center">
        {stripeUrl ? (
          <>
            <p className="text-sm font-medium">
              Ready? Stripe will walk you through the rest in about 10 minutes.
            </p>
            <a
              href={stripeUrl}
              rel="noopener noreferrer"
              className="mt-4 inline-flex"
            >
              <Button
                size="lg"
                className="gap-2 bg-primary px-8 text-base hover:bg-primary/90"
              >
                Continue to Stripe
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <p className="mt-3 text-[11px] text-muted-foreground">
              You&apos;ll be on Stripe&apos;s secure site (connect.stripe.com).
              When you finish, you&apos;ll be returned to Gamerhood automatically.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">
              We couldn&apos;t verify the secure link from your kid&apos;s
              device.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask them to re-share the link from their dashboard — Stripe
              onboarding links expire after about 5 minutes for security.
            </p>
            <Link href="/" className="mt-4 inline-flex">
              <Button variant="outline" size="lg">
                Go to Gamerhood home
              </Button>
            </Link>
          </>
        )}
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-neon-green" aria-hidden="true" />
          <span>SSL-encrypted; identity info goes directly to Stripe.</span>
        </div>
        <p>
          Questions? Reach out to{" "}
          <a
            href="mailto:support@gamerhood.gg"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            support@gamerhood.gg
          </a>
          .
        </p>
      </div>
    </div>
  );
}
