import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { getDefaultProfileForAuthUser, updateProfileStripe } from "@/lib/supabase/queries";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);
    const stripe = getStripe();

    let accountId = profile?.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        metadata: { gamerhood_user_id: user.id },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;
      await updateProfileStripe(supabase, user.id, accountId, false);
    }

    const origin = request.headers.get("origin") || "https://gamerhood.gg";
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard?stripe=refresh`,
      return_url: `${origin}/dashboard?stripe=complete`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    console.error("[Stripe Connect] Error:", err);
    return NextResponse.json(
      { error: "Failed to create Stripe onboarding link" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await getDefaultProfileForAuthUser(supabase, user.id);

    if (!profile?.stripe_account_id) {
      return NextResponse.json({ connected: false, onboarded: false });
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);
    const onboarded = account.charges_enabled && account.payouts_enabled;

    if (onboarded && !profile.stripe_onboarding_complete) {
      await updateProfileStripe(supabase, user.id, profile.stripe_account_id, true);
    }

    return NextResponse.json({
      connected: true,
      onboarded,
      accountId: profile.stripe_account_id,
    });
  } catch (err) {
    console.error("[Stripe Connect] Status check error:", err);
    return NextResponse.json(
      { error: "Failed to check Stripe status" },
      { status: 500 },
    );
  }
}
