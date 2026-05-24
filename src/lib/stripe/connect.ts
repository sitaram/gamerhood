import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { siteUrl } from "@/lib/site";
import { getServiceClient } from "@/lib/supabase/admin";
import { updateParentStripe } from "@/lib/supabase/queries";

const LOCAL_FALLBACK = "http://localhost:3000";

/**
 * Public site origin for Stripe Connect return/refresh URLs. Stripe will
 * redirect the user back to whatever we send here, so it MUST resolve to the
 * canonical domain Supabase Auth cookies are scoped to — otherwise the user
 * lands on a per-deployment Vercel hostname (e.g. `…-sitaram1-s-teams.vercel.app`),
 * appears signed out, and gets bounced to `/auth/login`.
 *
 * Defers to `siteUrl()` for the canonical origin in every environment EXCEPT
 * local dev, where we additionally trust request headers — that covers
 * `pnpm dev` on non-3000 ports / 127.0.0.1, and `vercel dev` style proxying.
 */
export function resolveConnectAppOrigin(request: NextRequest): string {
  const trim = (u: string) => u.replace(/\/+$/, "");

  const canonical = siteUrl();
  if (canonical !== LOCAL_FALLBACK) return canonical;

  const origin = request.headers.get("origin")?.trim();
  if (origin) return trim(origin);

  const rawHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim();
  const rawProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "";
  if (rawHost) {
    const localhost = /^(localhost|127\.0\.0\.1)/i.test(rawHost);
    const proto = rawProto || (localhost ? "http" : "https");
    return trim(`${proto}://${rawHost}`);
  }

  return canonical;
}

export function stripeConnectErrorMessage(err: unknown): string {
  const badKeySuffix =
    err instanceof Stripe.errors.StripeAuthenticationError
      ? " Verify STRIPE_SECRET_KEY (same mode as your Dashboard: test vs live)."
      : "";

  if (err instanceof Stripe.errors.StripeError && err.message?.trim()) {
    const raw = err.raw as { message?: unknown } | undefined;
    let base = stripStripeRequestId(err.message.trim());
    if (
      typeof raw?.message === "string" &&
      raw.message.trim().length > 0 &&
      stripStripeRequestId(raw.message.trim()) !== base
    ) {
      base = `${base} — ${stripStripeRequestId(raw.message.trim())}`;
    }
    if (/apiKey is required|No API key provided|Invalid API Key provided/i.test(base)) {
      return `${base}.${badKeySuffix || " Check STRIPE_SECRET_KEY on the server."}`;
    }
    return `${base}${badKeySuffix}`;
  }

  if (err && typeof err === "object" && "message" in err) {
    const m = String((err as { message: unknown }).message).trim();
    if (m) {
      const s = stripStripeRequestId(m);
      if (/STRIPE_SECRET_KEY|apiKey is required/i.test(s)) {
        return "Stripe secret key is missing or invalid — set STRIPE_SECRET_KEY on the server.";
      }
      return s;
    }
  }
  if (err instanceof Error && err.message.trim()) {
    const m = stripStripeRequestId(err.message.trim());
    if (m.includes("STRIPE_SECRET_KEY")) {
      return "Stripe secret key is missing — set STRIPE_SECRET_KEY on the server.";
    }
    return m;
  }
  return "Could not create Stripe onboarding link.";
}

/** Avoid noisy prefixes that aren’t actionable in the dashboard UI. */
function stripStripeRequestId(msg: string): string {
  return msg.replace(/^Request req_[A-Za-z0-9]+: /i, "").trim();
}

/**
 * Stable codes the dashboard UI can switch on to render targeted prompts
 * (e.g. an amber "enable Connect" callout) instead of dumping the raw
 * Stripe message into a red toast.
 */
export type StripeConnectErrorCode =
  | "platform_connect_not_enabled"
  | "stale_account"
  | "bad_api_key";

export interface StripeConnectErrorInfo {
  /** Human-readable message safe to render directly. */
  message: string;
  /** Machine-readable hint for the UI; omitted when we can't classify. */
  code?: StripeConnectErrorCode;
  /** External URL the user should visit to resolve the underlying issue. */
  actionUrl?: string;
}

/**
 * Returns the Stripe Dashboard "Connect settings" URL for the current mode
 * (test vs live), inferred from STRIPE_SECRET_KEY. Defaults to test so we
 * never accidentally send the developer to the live console.
 */
function vercelEnvSettingsUrl(): string {
  const owner = process.env.VERCEL_GIT_REPO_OWNER?.trim();
  const slug = process.env.VERCEL_GIT_REPO_SLUG?.trim();
  if (owner && slug) {
    return `https://vercel.com/${owner}/${slug}/settings/environment-variables`;
  }
  return "https://vercel.com/docs/projects/environment-variables";
}

function stripeConnectSettingsUrl(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (key.startsWith("sk_live_")) {
    return "https://dashboard.stripe.com/settings/connect";
  }
  return "https://dashboard.stripe.com/test/settings/connect";
}

/**
 * Pull the most "raw" message we can off whatever Stripe / Node threw at us
 * so the classifier can pattern-match without worrying about wrapping.
 */
function extractStripeRawMessage(err: unknown): string {
  if (err instanceof Stripe.errors.StripeError) {
    const raw = err.raw as { message?: unknown } | undefined;
    if (typeof raw?.message === "string" && raw.message.trim()) {
      return raw.message.trim();
    }
    if (err.message?.trim()) return err.message.trim();
  }
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  if (err instanceof Error && err.message?.trim()) return err.message.trim();
  return "";
}

/**
 * Classify a thrown Stripe error into a structured shape suitable for the
 * `/api/stripe/connect` JSON response. Falls back to the unstructured
 * `stripeConnectErrorMessage` text when the error doesn't match a known
 * pattern — callers can still surface it as plain red copy.
 */
export function classifyStripeConnectError(err: unknown): StripeConnectErrorInfo {
  const raw = extractStripeRawMessage(err);
  const fallback = stripeConnectErrorMessage(err);

  const missingKey =
    (err instanceof Error && /STRIPE_SECRET_KEY is not set/i.test(err.message)) ||
    (raw && /STRIPE_SECRET_KEY is not set/i.test(raw));
  if (missingKey) {
    const onVercel = process.env.VERCEL === "1";
    return {
      message: onVercel
        ? "Stripe secret key is missing on this deployment — add STRIPE_SECRET_KEY in Vercel → Settings → Environment Variables (Production), then redeploy."
        : "Stripe secret key is missing — set STRIPE_SECRET_KEY in .env.local and restart the dev server (e.g. bash scripts/dev-e2e-stripe.sh).",
      code: "bad_api_key",
      ...(onVercel ? { actionUrl: vercelEnvSettingsUrl() } : {}),
    };
  }

  // Platform-level: their Stripe account hasn't completed Connect platform
  // onboarding yet, so `accounts.create({type:"express"})` 400s.
  if (
    raw &&
    (/You can only create new accounts if you(?:'|’)?ve signed up for Connect/i.test(raw) ||
      /sign up for Connect/i.test(raw) ||
      /register your platform/i.test(raw) ||
      /platform(?:[^.]*?)\bConnect\b(?:[^.]*?)(?:enabled|registered|configur)/i.test(raw))
  ) {
    return {
      message: "Stripe Connect isn't enabled on this platform yet.",
      code: "platform_connect_not_enabled",
      actionUrl: stripeConnectSettingsUrl(),
    };
  }

  // The connect id we have stored points at an account Stripe no longer
  // recognizes (deleted, mode mismatch, restored from a different env, …).
  if (
    err instanceof Stripe.errors.StripeError &&
    (err.code === "account_invalid" || err.code === "resource_missing") &&
    /account/i.test(raw)
  ) {
    return {
      message:
        "We couldn't reach the Stripe account on file. The stored connect id may be stale — clearing it from this profile and reconnecting should resolve it.",
      code: "stale_account",
    };
  }
  if (raw && (/No such account/i.test(raw) || /\baccount_invalid\b/i.test(raw))) {
    return {
      message:
        "We couldn't reach the Stripe account on file. The stored connect id may be stale — clearing it from this profile and reconnecting should resolve it.",
      code: "stale_account",
    };
  }

  // Server-side credential problem; the user can't fix this, but we can at
  // least point the developer at the right knob.
  if (
    err instanceof Stripe.errors.StripeAuthenticationError ||
    (raw && /Invalid API Key provided|apiKey is required|No API key provided/i.test(raw))
  ) {
    return {
      message:
        "Stripe rejected the API key. Check STRIPE_SECRET_KEY in .env.local — it must match the same mode (test vs live) as your Stripe Dashboard.",
      code: "bad_api_key",
    };
  }

  return { message: fallback };
}

/**
 * Persist Connect account id after verifying the row belongs to authUserId via user-scoped client read.
 * Uses service role if the user session update fails (e.g. transient RLS/policy issues).
 */
export async function persistParentStripeConnectId(
  userClient: SupabaseClient,
  authUserId: string,
  parentRowId: string,
  stripeConnectId: string,
  onboardingComplete: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const first = await updateParentStripe(userClient, authUserId, stripeConnectId, onboardingComplete);
  if (!first.error) return { ok: true };

  console.error("[Stripe Connect] updateParentStripe (user session) failed:", first.error);

  try {
    const admin = getServiceClient();
    const second = await admin
      .from("parents")
      .update({
        stripe_connect_id: stripeConnectId,
        stripe_onboarding_complete: onboardingComplete,
      })
      .eq("auth_user_id", authUserId)
      .eq("id", parentRowId);
    if (second.error) {
      return {
        ok: false,
        message: `Could not save payout account: ${second.error.message}`,
      };
    }
    return { ok: true };
  } catch (svcErr) {
    const hint =
      svcErr instanceof Error ? svcErr.message : "service client unavailable";
    return {
      ok: false,
      message: `${first.error.message}. Service fallback failed (${hint}). Ensure SUPABASE_SERVICE_ROLE_KEY is set on the server.`,
    };
  }
}
