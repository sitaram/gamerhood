import { NextRequest, NextResponse } from "next/server";
import { getStripe, calculatePlatformFee } from "@/lib/stripe/client";

interface CheckoutItem {
  productId: string;
  printifyProductId?: string;
  printifyVariantId?: number;
  title: string;
  price: number;
  quantity: number;
  imageUrl: string;
  selectedColor: string;
  selectedSize?: string;
  creatorStripeAccountId?: string;
}

interface CheckoutRequest {
  items: CheckoutItem[];
  successUrl: string;
  cancelUrl: string;
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

    const lineItems = body.items.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.title,
          images: [item.imageUrl],
          metadata: {
            gamerhood_product_id: item.productId,
            printify_product_id: item.printifyProductId || "",
            printify_variant_id: String(item.printifyVariantId || ""),
            selected_color: item.selectedColor,
            selected_size: item.selectedSize || "",
          },
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const totalAmountCents = body.items.reduce(
      (sum, i) => sum + Math.round(i.price * 100) * i.quantity,
      0,
    );

    const creatorAccounts = [
      ...new Set(
        body.items.map((i) => i.creatorStripeAccountId).filter(Boolean),
      ),
    ];
    const isSingleCreator = creatorAccounts.length === 1;

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: "payment",
      line_items: lineItems,
      success_url: body.successUrl + "?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: body.cancelUrl,
      shipping_address_collection: { allowed_countries: ["US"] },
      metadata: {
        gamerhood_items: JSON.stringify(
          body.items.map((i) => ({
            productId: i.productId,
            printifyProductId: i.printifyProductId,
            printifyVariantId: i.printifyVariantId,
            quantity: i.quantity,
            selectedColor: i.selectedColor,
            selectedSize: i.selectedSize,
          })),
        ),
      },
    };

    if (isSingleCreator && creatorAccounts[0]) {
      sessionParams.payment_intent_data = {
        application_fee_amount: calculatePlatformFee(totalAmountCents),
        transfer_data: { destination: creatorAccounts[0] },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("[Checkout] Error creating session:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
