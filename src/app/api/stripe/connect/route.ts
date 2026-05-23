import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import {
  classifyStripeConnectError,
  persistParentStripeConnectId,
  resolveConnectAppOrigin,
} from "@/lib/stripe/connect";
import { createClient } from "@/lib/supabase/server";
import { getParentByAuthUserId } from "@/lib/supabase/queries";
import { isAdminEmail } from "@/lib/auth/admin";

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

    const stripe = getStripe();
    let accountId: string | null = parent.stripe_connect_id;

    if (!accountId) {
      const country = process.env.STRIPE_CONNECT_CREATOR_COUNTRY?.trim().toUpperCase();
      const connectEmail = (user.email ?? parent.email)?.trim();
      const account = await stripe.accounts.create({
        type: "express",
        ...(connectEmail ? { email: connectEmail } : {}),
        ...(country?.length === 2 ? { country } : {}),
        metadata: { gamerhood_user_id: user.id, gamerhood_parent_id: parent.id },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;

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

    const origin = resolveConnectAppOrigin(request);
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard?stripe=refresh`,
      return_url: `${origin}/dashboard?stripe=complete`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
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
