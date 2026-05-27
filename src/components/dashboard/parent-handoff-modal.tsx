"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrCode } from "@/components/qr/qr-code";

type HandoffMode = "onboarding" | "update";

interface ParentHandoffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "onboarding" before payouts active; "update" once they're active. */
  mode: HandoffMode;
  /**
   * Canonical public origin (https://www.gamerhood.gg) used to build the
   * `/parent-info?next=<stripe-url>` primer link. Resolved server-side so
   * preview/localhost builds don't bake a per-deploy hostname into the
   * URL we hand the parent.
   */
  siteOrigin: string;
}

/**
 * Stripe account links expire after ~5 minutes. Refresh whenever the link
 * we have is older than this so the QR / shared link is always live.
 */
const LINK_TTL_MS = 4 * 60 * 1000;

interface FetchResult {
  ok: boolean;
  url?: string;
  message?: string;
}

async function fetchOnboardingUrl(mode: HandoffMode): Promise<FetchResult> {
  try {
    const res = await fetch("/api/stripe/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      url?: unknown;
      error?: unknown;
    };
    if (!res.ok || typeof data.url !== "string") {
      const message =
        typeof data.error === "string"
          ? data.error
          : "Could not get the Stripe onboarding link";
      return { ok: false, message };
    }
    return { ok: true, url: data.url };
  } catch {
    return { ok: false, message: "Network error — please retry" };
  }
}

function buildPrimerUrl(siteOrigin: string, stripeUrl: string): string {
  return `${siteOrigin.replace(/\/+$/, "")}/parent-info?next=${encodeURIComponent(stripeUrl)}`;
}

const SMS_BODY = (mode: HandoffMode, url: string) =>
  mode === "update"
    ? `Hey! Can you help me update payouts on Gamerhood? Here's the link: ${url}`
    : `Hey! Can you help me set up payouts on Gamerhood? Here's the link: ${url}`;

const EMAIL_SUBJECT = (mode: HandoffMode) =>
  mode === "update"
    ? "Update my Gamerhood payout info?"
    : "Help me set up my Gamerhood account?";

const EMAIL_BODY = (mode: HandoffMode, url: string) =>
  mode === "update"
    ? `Hey,

Can you update the payout info on my Gamerhood account when you have a sec? It takes about 5 minutes.

Here's the link: ${url}

Thanks!`
    : `Hey,

Will you help me finish setting up my Gamerhood account so I can start selling my designs? I need an adult to do this part — it takes about 10 minutes.

Here's the link to start: ${url}

Thanks!`;

export function ParentHandoffModal({
  open,
  onOpenChange,
  mode,
  siteOrigin,
}: ParentHandoffModalProps) {
  const [stripeUrl, setStripeUrl] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const requestSeq = useRef(0);

  /**
   * Refresh the Stripe link whenever the modal opens with a stale link
   * (none yet, or older than `LINK_TTL_MS`). Setters only fire inside
   * the resolved-promise callback so we satisfy
   * `react-hooks/set-state-in-effect` — no synchronous setState in the
   * effect body.
   */
  useEffect(() => {
    if (!open) return;
    const stale =
      !stripeUrl ||
      createdAt === null ||
      Date.now() - createdAt > LINK_TTL_MS;
    if (!stale) return;

    const seq = ++requestSeq.current;
    let cancelled = false;
    fetchOnboardingUrl(mode).then((res) => {
      if (cancelled || seq !== requestSeq.current) return;
      if (!res.ok) {
        setError(res.message ?? "Could not get the Stripe onboarding link");
        return;
      }
      setStripeUrl(res.url ?? null);
      setCreatedAt(Date.now());
      setError(null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, mode, stripeUrl, createdAt]);

  const primerUrl = stripeUrl ? buildPrimerUrl(siteOrigin, stripeUrl) : null;
  /**
   * Derive the "spinner" state instead of synchronously flipping a
   * `loading` state inside the effect (which trips the lint rule).
   */
  const fetching = open && !stripeUrl && !error;
  const smsHref = primerUrl
    ? `sms:?&body=${encodeURIComponent(SMS_BODY(mode, primerUrl))}`
    : "#";
  const mailHref = primerUrl
    ? `mailto:?subject=${encodeURIComponent(EMAIL_SUBJECT(mode))}&body=${encodeURIComponent(EMAIL_BODY(mode, primerUrl))}`
    : "#";

  async function handleCopy() {
    if (!primerUrl) return;
    try {
      await navigator.clipboard.writeText(primerUrl);
      setCopied(true);
      toast("Link copied — share it with your parent");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy link");
    }
  }

  async function handleRefresh() {
    const seq = ++requestSeq.current;
    setRefreshing(true);
    setError(null);
    const res = await fetchOnboardingUrl(mode);
    if (seq !== requestSeq.current) return;
    setRefreshing(false);
    if (!res.ok) {
      setError(res.message ?? "Could not refresh the link");
      return;
    }
    setStripeUrl(res.url ?? null);
    setCreatedAt(Date.now());
    toast("Link refreshed");
  }

  const isUpdate = mode === "update";
  const title = isUpdate
    ? "Send to your parent to update payout info"
    : "Ask a parent to set this up";
  const intro = isUpdate
    ? "Stripe handles your payouts. To change the bank account or any verification info, an adult on the account has to sign in. Share the link below — they can do it on any phone or computer. Takes about 5 minutes."
    : "Stripe sends your earnings to a bank account. We need an adult (a parent, guardian, or you if you're 18+) to set it up. Share the link below — they can do it on any phone or computer. Takes about 10 minutes.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">{title}</DialogTitle>
          <DialogDescription>{intro}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-muted/40 p-4">
          {fetching || refreshing ? (
            <div className="flex h-[220px] w-[220px] items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Building secure link…
            </div>
          ) : error && !primerUrl ? (
            <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-destructive">
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            </div>
          ) : primerUrl ? (
            <>
              <QrCode url={primerUrl} size={220} logo />
              <p className="text-center text-xs text-muted-foreground">
                Have your parent scan with their phone camera, or share the link below.
              </p>
            </>
          ) : null}
        </div>

        {primerUrl && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={handleCopy}
                className="flex-1 gap-2"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-neon-green" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <a href={smsHref} className="flex-1" aria-label="Share via text message">
                <Button variant="outline" className="w-full gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Text
                </Button>
              </a>
              <a href={mailHref} className="flex-1" aria-label="Share via email">
                <Button variant="outline" className="w-full gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Button>
              </a>
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        )}

        {!isUpdate && (
          <div className="rounded-lg border border-border/50 bg-background p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What your parent needs
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground/90">
              <li className="flex gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Their date of birth and home address
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Last 4 of their SSN (full SSN for US tax purposes)
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                A US bank account (routing + account number, or a debit card)
              </li>
              <li className="flex gap-2">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                About 10 minutes
              </li>
            </ul>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {isUpdate
            ? "After they finish, payouts will route to whatever bank account they enter. The account stays in their name; we don't change it."
            : "After they finish, payouts will go to the bank account they enter. That bank account stays in their name; we don't change it."}
        </p>
      </DialogContent>
    </Dialog>
  );
}
