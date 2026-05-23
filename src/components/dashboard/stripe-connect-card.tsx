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
      })
      .catch(() => {
        if (!cancelled) setStatus({ connected: false, onboarded: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function startOnboarding() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
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
      // Redirect the browser to Stripe's hosted Express onboarding.
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
            onClick={startOnboarding}
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
  if (status.onboarded) {
    return (
      <Card className="flex items-center justify-between border-neon-green/30 bg-neon-green/5 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-neon-green" />
          <div>
            <p className="text-sm font-medium">Payouts active</p>
            <p className="text-xs text-muted-foreground">
              Earnings from sales will land in your bank account.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={startOnboarding}
          disabled={loading}
          className="text-xs"
        >
          Manage
        </Button>
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
          <p className="text-sm font-medium">
            {isResuming ? "Finish setting up payouts" : "Set up payouts"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isResuming
              ? "You started onboarding but haven't finished. Continue to start receiving earnings."
              : "Connect a bank account via Stripe so we can pay you when your designs sell."}
          </p>
          {error && (
            <p className="mt-1 text-xs text-destructive">{error.message}</p>
          )}
        </div>
      </div>
      <Button
        onClick={startOnboarding}
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
