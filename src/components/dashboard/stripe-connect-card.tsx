"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Share2,
  Users,
} from "lucide-react";
import { XpBadge } from "@/components/xp/xp-badge";
import { showXpToasts } from "@/components/xp/show-xp-toasts";
import { XP_RULES } from "@/lib/xp/rules";
import { ParentHandoffModal } from "@/components/dashboard/parent-handoff-modal";

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
 * Poll cadence for the "did my parent finish?" status check. 30s is gentle
 * enough that even a long onboarding session won't generate more than ~60
 * Stripe `accounts.retrieve` calls — and we still pause when the tab is
 * hidden and stop entirely after `POLL_IDLE_TIMEOUT_MS`.
 */
const POLL_INTERVAL_MS = 30_000;
const POLL_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

interface StripeConnectCardProps {
  /**
   * Canonical site origin (resolved server-side via `siteUrl()`). Passed
   * down so the parent-handoff modal can build a `gamerhood.gg/parent-info`
   * link that's stable across preview/dev hostnames.
   */
  siteOrigin: string;
}

/**
 * Inline onboarding card for the creator dashboard. Reads connect status on
 * mount, polls every ~30s while not yet onboarded (visibility-aware, idle-
 * timed-out), then either prompts the parent to start onboarding (POST) or
 * shows a "Continue setup" / "Payouts active" state. Mirrors the API
 * contract in src/app/api/stripe/connect/route.ts.
 */
export function StripeConnectCard({ siteOrigin }: StripeConnectCardProps) {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ConnectError | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  /** Sticky once the parent-handoff modal has been opened — surfaces the
   * "Link shared — refresh to check…" affordance even after the modal closes. */
  const [shared, setShared] = useState(false);
  /**
   * `null` until the first status fetch completes. The polling effect
   * uses this (plus `pollStartedAt`) to decide when to stop.
   */
  const pollStartedAt = useRef<number | null>(null);

  const fetchStatus = useCallback(async (): Promise<ConnectStatus | null> => {
    try {
      const res = await fetch("/api/stripe/connect");
      const data = await res.json();
      if (typeof data?.error === "string") {
        setError({
          message: data.error,
          code: typeof data.code === "string" ? data.code : undefined,
          actionUrl:
            typeof data.actionUrl === "string" ? data.actionUrl : undefined,
        });
        const next = { connected: false, onboarded: false };
        setStatus(next);
        return next;
      }
      const next: ConnectStatus = {
        connected: Boolean(data?.connected),
        onboarded: Boolean(data?.onboarded),
        accountId:
          typeof data?.accountId === "string" ? data.accountId : undefined,
      };
      setStatus(next);
      // The GET also flips `xpAwards` the first time we see the account
      // become onboarded — surface the +200 XP toast once Stripe finishes.
      if (Array.isArray(data?.xpAwards)) showXpToasts(data.xpAwards);
      return next;
    } catch {
      const fallback = { connected: false, onboarded: false };
      setStatus((prev) => prev ?? fallback);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchStatus().then(() => {
      if (!cancelled && pollStartedAt.current === null) {
        pollStartedAt.current = Date.now();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchStatus]);

  /**
   * Auto-poll while the kid is waiting on a parent. We guard with:
   *   - `status?.onboarded` — stop the moment Stripe flips on payouts.
   *   - `document.visibilityState` — pause while the tab is hidden so we
   *     aren't burning Stripe API quota for a backgrounded dashboard.
   *   - `POLL_IDLE_TIMEOUT_MS` — give up after 30 min so we don't poll
   *     a kid's laptop overnight.
   */
  useEffect(() => {
    if (status === null) return;
    if (status.onboarded) return;

    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      if (cancelled) return;
      const startedAt = pollStartedAt.current ?? Date.now();
      if (Date.now() - startedAt > POLL_IDLE_TIMEOUT_MS) {
        if (timer !== null) {
          window.clearInterval(timer);
          timer = null;
        }
        return;
      }
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      const next = await fetchStatus();
      if (next?.onboarded && timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    timer = window.setInterval(tick, POLL_INTERVAL_MS);

    /**
     * When the tab regains focus after sitting idle, run an immediate
     * check so the card flips to "Connected" without waiting up to 30s.
     */
    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [status, fetchStatus]);

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
      window.location.href = data.url;
    } catch {
      setError({ message: "Network error — please retry" });
    } finally {
      setLoading(false);
    }
  }

  function openHandoff() {
    setHandoffOpen(true);
    setShared(true);
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
  if (status.onboarded) {
    return (
      <>
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
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
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
            <Button
              variant="ghost"
              size="sm"
              onClick={openHandoff}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share this link with your parent
            </Button>
            <p className="text-[11px] text-muted-foreground sm:text-right">
              Change your bank account, address, or verification details.
            </p>
          </div>
        </Card>
        <ParentHandoffModal
          open={handoffOpen}
          onOpenChange={setHandoffOpen}
          mode="update"
          siteOrigin={siteOrigin}
        />
      </>
    );
  }

  // ── Connected but not finished, or not connected ──
  const isResuming = status.connected;
  return (
    <>
      <Card className="flex flex-col gap-3 border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button
              onClick={openHandoff}
              variant="outline"
              className="gap-2 border-primary/40 text-foreground hover:bg-primary/10 sm:w-auto"
            >
              <Users className="h-4 w-4" />
              Ask a parent to set this up
            </Button>
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
          </div>
        </div>
        {shared && (
          <div className="rounded-md border border-border/50 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Link shared.</span>{" "}
            We&apos;re checking automatically — this card will flip to &ldquo;Connected&rdquo; the moment your parent finishes.
          </div>
        )}
      </Card>
      <ParentHandoffModal
        open={handoffOpen}
        onOpenChange={setHandoffOpen}
        mode="onboarding"
        siteOrigin={siteOrigin}
      />
    </>
  );
}
