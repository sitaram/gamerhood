import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import {
  classifyStripeConnectError,
  persistParentStripeConnectId,
  resolveConnectAppOrigin,
} from "@/lib/stripe/connect";
import { createClient } from "@/lib/supabase/server";
import {
  getParentByAuthUserId,
  getProfileByParentId,
} from "@/lib/supabase/queries";
import { isAdminEmail } from "@/lib/auth/admin";
import { siteUrl } from "@/lib/site";

type AccountLinkType = "account_onboarding" | "account_update";
type ConnectMode = "onboarding" | "update";

/**
 * Optional POST body lets the dashboard skip a redundant `accounts.retrieve`
 * when it already knows the account is fully onboarded. Body is optional;
 * when absent or malformed we fall back to server-side state detection.
 */
async function readRequestedMode(
  request: NextRequest,
): Promise<ConnectMode | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    const body = JSON.parse(text) as { mode?: unknown };
    if (body?.mode === "update" || body?.mode === "onboarding") {
      return body.mode;
    }
  } catch {
    // Empty / non-JSON body — fall through to server-side detection.
  }
  return null;
}

/**
 * Stripe rejects `account_update` for accounts where the platform isn't
 * responsible for collecting requirements (most hosted Express setups).
 * The hosted onboarding flow handles "edit mode" gracefully when nothing
 * is missing, so we fall back to it transparently.
 */
function isAccountUpdateUnsupported(err: unknown): boolean {
  if (!(err instanceof Stripe.errors.StripeError)) return false;
  const raw = err.raw as { message?: unknown } | undefined;
  const msg = (typeof raw?.message === "string" ? raw.message : err.message) ?? "";
  return /account_update/i.test(msg) && /not supported|not allowed|invalid/i.test(msg);
}

/**
 * Shape the classifier's output into the JSON the dashboard card consumes.
 *
 * Platform-level errors (`platform_connect_not_enabled`, `bad_api_key`) are
 * filtered to only expose admin chrome — diagnostic message, action URL —
 * to platform admins. Non-admins get a friendly "we're setting this up"
 * message with no actionable link, because they can't log into the
 * platform's Stripe dashboard or fix server env vars anyway. Per-account
 * errors (`stale_account` etc.) still surface to the affected user so they
 * can take the right next step.
 */
function connectErrorResponse(
  err: unknown,
  status: number,
  viewerIsAdmin: boolean,
) {
  const info = classifyStripeConnectError(err);
  const isPlatformLevel =
    info.code === "platform_connect_not_enabled" || info.code === "bad_api_key";

  if (isPlatformLevel && !viewerIsAdmin) {
    return NextResponse.json(
      {
        error:
          "Payouts setup isn't available yet — our team is finishing the configuration. Please check back soon.",
        code: "platform_setup_pending",
      },
      { status },
    );
  }

  return NextResponse.json(
    {
      error: info.message,
      ...(info.code ? { code: info.code } : {}),
      ...(info.actionUrl ? { actionUrl: info.actionUrl } : {}),
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  let viewerIsAdmin = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    viewerIsAdmin = isAdminEmail(user.email);

    const { data: parent, error: parentErr } = await getParentByAuthUserId(
      supabase,
      user.id,
    );
    if (parentErr || !parent) {
      return NextResponse.json(
        { error: "Parent record not found. Complete account setup first." },
        { status: 400 },
      );
    }

    const requestedMode = await readRequestedMode(request);

    const stripe = getStripe();
    let accountId: string | null = parent.stripe_connect_id;
    let justCreated = false;

    if (!accountId) {
      const country = process.env.STRIPE_CONNECT_CREATOR_COUNTRY?.trim().toUpperCase();
      const connectEmail = (user.email ?? parent.email)?.trim();

      // Pre-fill business profile so Stripe Express onboarding only asks the
      // creator for identity (DOB/SSN/address) + bank + ToS, instead of 8
      // screens of business-side data we already know.
      const { data: profile } = await getProfileByParentId(supabase, parent.id);
      const slug =
        typeof profile?.slug === "string" && profile.slug.trim().length > 0
          ? profile.slug.trim()
          : null;
      const siteOrigin = siteUrl();
      const storefrontUrl = slug ? `${siteOrigin}/shop/${slug}` : siteOrigin;

      const rawDisplayName =
        (typeof profile?.display_name === "string" ? profile.display_name : "") ||
        (typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : "");
      const storefrontName = rawDisplayName.trim() || undefined;

      const businessProfile: Stripe.AccountCreateParams.BusinessProfile = {
        mcc: "5945",
        product_description:
          "Custom merchandise (apparel, prints, accessories) sold via the Gamerhood creator marketplace at gamerhood.gg",
        support_email: "support@gamerhood.gg",
        support_url: `${siteOrigin}/faq`,
        url: storefrontUrl,
        ...(storefrontName ? { name: storefrontName } : {}),
      };

      const account = await stripe.accounts.create({
        type: "express",
        business_type: "individual",
        business_profile: businessProfile,
        ...(connectEmail ? { email: connectEmail } : {}),
        ...(country?.length === 2 ? { country } : {}),
        metadata: { gamerhood_user_id: user.id, gamerhood_parent_id: parent.id },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;
      justCreated = true;

      const saved = await persistParentStripeConnectId(
        supabase,
        user.id,
        parent.id,
        accountId,
        false,
      );
      if (!saved.ok) {
        console.error("[Stripe Connect] Could not persist connect id:", saved.message);
        return NextResponse.json({ error: saved.message }, { status: 500 });
      }
    }

    // Fully-onboarded accounts get an `account_update` link (edit profile);
    // anything else (incomplete requirements, brand-new) stays on
    // `account_onboarding`. We skip the extra retrieve for accounts we
    // just created in this request and when the caller is explicit.
    let linkType: AccountLinkType = "account_onboarding";
    if (!justCreated) {
      if (requestedMode === "update") {
        linkType = "account_update";
      } else if (requestedMode !== "onboarding") {
        const account = await stripe.accounts.retrieve(accountId);
        if (account.charges_enabled && account.payouts_enabled) {
          linkType = "account_update";
        }
      }
    }

    const origin = resolveConnectAppOrigin(request);
    const refresh_url = `${origin}/dashboard?stripe=refresh`;
    const return_url = `${origin}/dashboard?stripe=complete`;

    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url,
        return_url,
        type: linkType,
      });
      return NextResponse.json({ url: accountLink.url });
    } catch (err) {
      if (linkType === "account_update" && isAccountUpdateUnsupported(err)) {
        const accountLink = await stripe.accountLinks.create({
          account: accountId,
          refresh_url,
          return_url,
          type: "account_onboarding",
        });
        return NextResponse.json({ url: accountLink.url });
      }
      throw err;
    }
  } catch (err) {
    console.error("[Stripe Connect] Error:", err);
    return connectErrorResponse(err, 500, viewerIsAdmin);
  }
}

export async function GET() {
  let viewerIsAdmin = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    viewerIsAdmin = isAdminEmail(user.email);

    const { data: parent } = await getParentByAuthUserId(supabase, user.id);

    if (!parent?.stripe_connect_id) {
      return NextResponse.json({ connected: false, onboarded: false });
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(parent.stripe_connect_id);
    const onboarded = Boolean(account.charges_enabled && account.payouts_enabled);

    if (onboarded && !parent.stripe_onboarding_complete) {
      const persisted = await persistParentStripeConnectId(
        supabase,
        user.id,
        parent.id,
        parent.stripe_connect_id,
        true,
      );
      if (!persisted.ok) {
        console.warn("[Stripe Connect] onboarding flag persist failed:", persisted.message);
      }
    }

    return NextResponse.json({
      connected: true,
      onboarded,
      accountId: parent.stripe_connect_id,
    });
  } catch (err) {
    console.error("[Stripe Connect] Status check error:", err);
    return connectErrorResponse(err, 500, viewerIsAdmin);
  }
}
