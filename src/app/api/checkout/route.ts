import { NextRequest, NextResponse } from "next/server";
import { getStripe, calculatePlatformFee, PLATFORM_FEE_PERCENT } from "@/lib/stripe/client";
import { TAX_CODE_BY_TYPE, isAutomaticTaxEnabled } from "@/lib/stripe/tax-codes";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  insertOrder,
  insertOrderItems,
  type OrderItemInsert,
} from "@/lib/supabase/queries";
import type { ProductType } from "@/lib/types";

interface CheckoutItem {
  productId: string;
  printfulCatalogVariantId?: number;
  title: string;
  price: number;
  quantity: number;
  imageUrl: string;
  selectedColor: string;
  selectedSize?: string;
  creatorStripeAccountId?: string;
  // Profile (creator) id, needed so the order_items row records who earned it.
  profileId?: string;
}

interface CheckoutRequest {
  items: CheckoutItem[];
  successUrl: string;
  cancelUrl: string;
  buyerEmail?: string;
}

export async function POST(request: NextRequest) {
  let body: CheckoutRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.items?.length) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const supabase = getServiceClient();

    // ── Hydrate item details from the DB so we trust prices and creator
    // Stripe accounts. The browser-supplied values are only hints; the source
    // of truth is the products table joined to parents.
    const productIds = Array.from(new Set(body.items.map((i) => i.productId)));
    const { data: dbProducts } = await supabase
      .from("products")
      .select(
        `id, profile_id, title, product_type, base_price_cents, markup_cents, mockup_url,
         printful_catalog_variant_id,
         profiles ( parents ( stripe_connect_id, stripe_onboarding_complete ) )`,
      )
      .in("id", productIds);

    type DbProduct = {
      id: string;
      profile_id: string;
      title: string;
      product_type: ProductType;
      base_price_cents: number;
      markup_cents: number;
      mockup_url: string | null;
      printful_catalog_variant_id: number | null;
      profiles?: {
        parents?: {
          stripe_connect_id: string | null;
          stripe_onboarding_complete: boolean | null;
        } | null;
      } | null;
    };

    const productsById = new Map<string, DbProduct>(
      (dbProducts as unknown as DbProduct[] | null)?.map((p) => [p.id, p]) ?? [],
    );

    // Reject the request if any item references a product we can't resolve;
    // that would mean a stale cart or a tampered request.
    const missing = body.items.filter((i) => !productsById.has(i.productId));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Some items in your cart are no longer available" },
        { status: 400 },
      );
    }

    const taxEnabled = isAutomaticTaxEnabled();

    const lineItems = body.items.map((item) => {
      const dbProduct = productsById.get(item.productId)!;
      const unitCents = dbProduct.base_price_cents + dbProduct.markup_cents;
      // When Stripe Tax is on, the `tax_code` drives per-state apparel
      // exemptions (NY <$110, PA all-exempt, MA <$175, …). When it's off
      // Stripe ignores the field, so we can pass it unconditionally.
      const taxCode = TAX_CODE_BY_TYPE[dbProduct.product_type];
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: dbProduct.title,
            images: dbProduct.mockup_url ? [dbProduct.mockup_url] : undefined,
            ...(taxCode ? { tax_code: taxCode } : {}),
            metadata: {
              gamerhood_product_id: dbProduct.id,
              printful_catalog_variant_id: String(
                dbProduct.printful_catalog_variant_id ?? "",
              ),
              selected_color: item.selectedColor,
              selected_size: item.selectedSize ?? "",
            },
          },
          // Prices are tax-EXCLUSIVE: the buyer is shown $30 then tax is
          // added as a separate line on the Checkout page. (Switch to
          // "inclusive" later if we want to bake tax into the sticker price.)
          ...(taxEnabled ? { tax_behavior: "exclusive" as const } : {}),
          unit_amount: unitCents,
        },
        quantity: item.quantity,
      };
    });

    const totalAmountCents = body.items.reduce((sum, i) => {
      const p = productsById.get(i.productId)!;
      return sum + (p.base_price_cents + p.markup_cents) * i.quantity;
    }, 0);

    // Stripe Connect can only route a single transfer destination per
    // PaymentIntent, so we only attach Connect when every cart item belongs to
    // the same fully-onboarded creator. Multi-creator carts go to the
    // platform account and are reconciled with manual transfers later.
    const connectAccounts = new Set<string>();
    for (const i of body.items) {
      const parent = productsById.get(i.productId)?.profiles?.parents;
      if (parent?.stripe_onboarding_complete && parent.stripe_connect_id) {
        connectAccounts.add(parent.stripe_connect_id);
      }
    }
    const isSingleCreator = connectAccounts.size === 1;
    const connectAccount = isSingleCreator ? [...connectAccounts][0] : null;

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: "payment",
      line_items: lineItems,
      success_url: body.successUrl + "?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: body.cancelUrl,
      shipping_address_collection: { allowed_countries: ["US"] },
      // Stripe Tax computes sales tax from the buyer's shipping address.
      // Off until the platform is registered with at least one state and
      // STRIPE_AUTOMATIC_TAX=1 in env. See lib/stripe/tax-codes.ts.
      ...(taxEnabled ? { automatic_tax: { enabled: true } } : {}),
      // Customer email is collected by Stripe Checkout; we forward any hint
      // we have so users with an account skip retyping.
      ...(body.buyerEmail ? { customer_email: body.buyerEmail } : {}),
      // Light metadata for back-reference on the webhook side. Keep it small
      // (Stripe limits to 50 keys / 500 chars per value).
      metadata: {
        gamerhood_item_count: String(body.items.length),
      },
    };

    if (connectAccount) {
      // KNOWN LIMITATION: when STRIPE_AUTOMATIC_TAX=1 AND we're routing via
      // a destination charge, Stripe adds the tax on top of the line-item
      // total and gives the destination account `(subtotal + tax) -
      // application_fee`. That hands the tax money to the creator instead
      // of the platform, which is wrong under marketplace facilitator law
      // (the platform is the merchant of record for tax). The fix is to
      // switch from destination charges to "separate charge + manual
      // transfer in the webhook" once tax is on. Until then we log a
      // warning so we notice if/when this combination ships to prod.
      if (taxEnabled) {
        console.warn(
          "[Checkout] STRIPE_AUTOMATIC_TAX + Connect destination charge: " +
            "tax revenue will incorrectly flow to the connected account. " +
            "Refactor to separate-charge + manual-transfer before scaling.",
        );
      }
      sessionParams.payment_intent_data = {
        application_fee_amount: calculatePlatformFee(totalAmountCents),
        transfer_data: { destination: connectAccount },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // ── Persist the order in `pending` state so the Stripe webhook (running
    // unauthenticated) can find it by session id and update status. The
    // service-role client bypasses RLS.
    const platformFeeCents = calculatePlatformFee(totalAmountCents);
    const { data: orderRow, error: orderErr } = await insertOrder(supabase, {
      buyer_email: body.buyerEmail ?? "",
      stripe_session_id: session.id,
      total_cents: totalAmountCents,
      platform_fee_cents: platformFeeCents,
      status: "pending",
    });

    if (orderErr || !orderRow) {
      console.error("[Checkout] Failed to persist order:", orderErr);
      // We've already created the Stripe session at this point. Continue —
      // the webhook will log a "no matching order" warning when it fires,
      // but the payment is still valid and Printful can be triggered manually.
    } else {
      const orderItems: OrderItemInsert[] = body.items.map((item) => {
        const p = productsById.get(item.productId)!;
        const unitCents = p.base_price_cents + p.markup_cents;
        // Creator earnings = unit price × qty − platform's slice for this line.
        // We keep the math simple per-line; reconciliation lives in admin.
        const itemPlatformCut = Math.round(
          unitCents * item.quantity * (PLATFORM_FEE_PERCENT / 100),
        );
        return {
          order_id: orderRow.id,
          product_id: p.id,
          profile_id: p.profile_id,
          quantity: item.quantity,
          unit_price_cents: unitCents,
          creator_earnings_cents: unitCents * item.quantity - itemPlatformCut,
          selected_color: item.selectedColor,
          selected_size: item.selectedSize ?? null,
        };
      });
      const { error: itemsErr } = await insertOrderItems(supabase, orderItems);
      if (itemsErr) console.error("[Checkout] Failed to persist order items:", itemsErr);
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("[Checkout] Error creating session:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
