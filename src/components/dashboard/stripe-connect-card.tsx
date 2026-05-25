"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  RotateCw,
} from "lucide-react";
import { XpBadge } from "@/components/xp/xp-badge";
import { showXpToasts } from "@/components/xp/show-xp-toasts";
import { XP_RULES } from "@/lib/xp/rules";

interface ConnectStatus {
  connected: boolean;
  onboarded: boolean;
  accountId?: string;
}

/**
 * Structured error returned by `/api/stripe/connect`. When `code` and
 * `actionUrl` are present we render an amber callout with a direct CTA
 * instead of dumping the raw red Stripe message.
 */
interface ConnectError {
  message: string;
  code?: string;
  actionUrl?: string;
}

/**
 * Inline onboarding card for the creator dashboard. Reads connect status on
 * mount, then either prompts the parent to start onboarding (POST) or shows
 * a "Continue setup" / "Payouts active" state. Mirrors the API contract in
 * src/app/api/stripe/connect/route.ts.
 */
export function StripeConnectCard() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ConnectError | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stripe/connect")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        // The GET also returns structured errors on failure (e.g. when the
        // platform isn't Connect-enabled). Surface those instead of
        // silently flipping to the "not connected" CTA — otherwise the
        // user will hit the same error again when they click it.
        if (typeof data?.error === "string") {
          setError({
            message: data.error,
            code: typeof data.code === "string" ? data.code : undefined,
            actionUrl:
              typeof data.actionUrl === "string" ? data.actionUrl : undefined,
          });
          setStatus({ connected: false, onboarded: false });
          return;
        }
        setStatus({
          connected: Boolean(data?.connected),
          onboarded: Boolean(data?.onboarded),
          accountId:
            typeof data?.accountId === "string" ? data.accountId : undefined,
        });
        // The GET also flips `xpAwards` the first time we see the account
        // become onboarded — surface the +200 XP toast on the very next
        // dashboard load after the user finishes Stripe onboarding.
        if (Array.isArray(data?.xpAwards)) showXpToasts(data.xpAwards);
      })
      .catch(() => {
        if (!cancelled) setStatus({ connected: false, onboarded: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function startOnboarding(mode?: "onboarding" | "update") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        ...(mode
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode }),
            }
          : {}),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError({
          message: data.error || "Failed to start onboarding",
          code: typeof data.code === "string" ? data.code : undefined,
          actionUrl:
            typeof data.actionUrl === "string" ? data.actionUrl : undefined,
        });
        return;
      }
      // Redirect the browser to Stripe's hosted Express onboarding / edit flow.
      window.location.href = data.url;
    } catch {
      setError({ message: "Network error — please retry" });
    } finally {
      setLoading(false);
    }
  }

  // ── Loading state ──
  if (status === null) {
    return (
      <Card className="flex items-center gap-3 border-border/50 bg-card p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Checking payout status…</span>
      </Card>
    );
  }

  // ── Non-admin friendly state when the platform itself isn't configured ──
  // The API has already redacted the technical details and substituted a
  // user-safe message — render it as a calm "we're on it" card, no scary
  // amber chrome and no link the user can't act on.
  if (error && error.code === "platform_setup_pending") {
    return (
      <Card className="flex items-start gap-3 border-border/60 bg-muted/40 p-4">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Payouts coming soon</p>
          <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        </div>
      </Card>
    );
  }

  if (error && error.code === "bad_api_key") {
    return (
      <Card className="flex flex-col gap-3 border-amber-500/40 bg-amber-500/10 p-4 text-foreground">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
              Stripe server key not configured
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
          </div>
        </div>
        {error.actionUrl ? (
          <a
            href={error.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            <Button className="gap-2 bg-amber-500 text-amber-950 hover:bg-amber-400">
              Open Vercel environment variables
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        ) : null}
      </Card>
    );
  }

  // ── Structured platform-level error (e.g. Connect not enabled) ──
  // Only reaches here for platform admins; the API filters this view away
  // from regular creators. Amber "do this one thing" treatment so it's
  // immediately distinguishable from a code bug.
  if (error && error.actionUrl) {
    return (
      <Card className="flex flex-col gap-3 border-amber-500/40 bg-amber-500/10 p-4 text-foreground">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
              Finish setting up Stripe Connect first
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your platform Stripe account needs Connect enabled before any
              creator can be onboarded for payouts. You only need to do this
              once for the whole site.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/80">{error.message}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <a
            href={error.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            <Button className="gap-2 bg-amber-500 text-amber-950 hover:bg-amber-400">
              Enable Connect in Stripe
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => startOnboarding()}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  // ── Fully onboarded ──
  // The "Update payout info" button passes `mode: "update"` so the API
  // returns an `account_update` link (Stripe's "edit your info" flow)
  // without re-doing the retrieve we already performed on mount.
  if (status.onboarded) {
    return (
      <Card className="flex flex-col gap-3 border-neon-green/30 bg-neon-green/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-neon-green" />
          <div>
            <p className="text-sm font-medium">Payouts active</p>
            <p className="text-xs text-muted-foreground">
              Earnings from sales will land in your bank account.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Payouts for{" "}
              <span className="font-medium text-foreground">all your storefronts</span>{" "}
              route to this Stripe account.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => startOnboarding("update")}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Update payout info
          </Button>
          <p className="text-[11px] text-muted-foreground sm:text-right">
            Change your bank account, address, or verification details.
          </p>
        </div>
      </Card>
    );
  }

  // ── Connected but not finished, or not connected ──
  const isResuming = status.connected;
  return (
    <Card className="flex flex-col gap-3 border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <CreditCard className="mt-0.5 h-5 w-5 text-primary shrink-0" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">
              {isResuming ? "Finish setting up payouts" : "Set up payouts"}
            </p>
            <XpBadge points={XP_RULES.STRIPE_CONNECTED.points} variant="inline" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isResuming
              ? "You started onboarding but haven't finished. Continue to start receiving earnings."
              : "Connect a bank account via Stripe so we can pay you when your designs sell."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            One Stripe account covers{" "}
            <span className="font-medium text-foreground">every storefront</span> you
            run on Gamerhood.
          </p>
          {error && (
            <p className="mt-1 text-xs text-destructive">{error.message}</p>
          )}
        </div>
      </div>
      <Button
        onClick={() => startOnboarding()}
        disabled={loading}
        className="gap-2 bg-primary hover:bg-primary/90 sm:w-auto"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting…
          </>
        ) : (
          <>
            {isResuming ? "Continue setup" : "Connect with Stripe"}
            <ExternalLink className="h-4 w-4" />
          </>
        )}
      </Button>
    </Card>
  );
}
