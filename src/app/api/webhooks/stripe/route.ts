import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { submitOrder, sendToProduction } from "@/lib/printify/client";
import type { PrintifyOrderAddress } from "@/lib/printify/client";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook verification failed: ${message}` },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await handleCheckoutCompleted(session);
    } catch (err) {
      console.error("[Stripe Webhook] Error handling checkout.session.completed:", err);
      return NextResponse.json(
        { error: "Failed to process checkout" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const itemsMeta = session.metadata?.gamerhood_items;
  if (!itemsMeta) return;

  let items: {
    productId: string;
    printifyProductId?: string;
    printifyVariantId?: number;
    quantity: number;
    selectedColor: string;
    selectedSize?: string;
  }[];

  try {
    items = JSON.parse(itemsMeta);
  } catch {
    console.error("[Stripe Webhook] Failed to parse gamerhood_items metadata");
    return;
  }

  const sessionAny = session as unknown as Record<string, Record<string, unknown> | undefined>;
  const shipping = sessionAny.shipping_details;
  const shippingAddr = shipping?.address as Record<string, string> | undefined;
  if (!shippingAddr) {
    console.error("[Stripe Webhook] No shipping address on session", session.id);
    return;
  }

  const nameParts = (String(shipping?.name || "Customer")).split(" ");
  const address: PrintifyOrderAddress = {
    first_name: nameParts[0] || "Customer",
    last_name: nameParts.slice(1).join(" ") || "",
    email: String(session.customer_details?.email || ""),
    phone: String(session.customer_details?.phone || ""),
    country: shippingAddr.country || "US",
    region: shippingAddr.state || "",
    address1: shippingAddr.line1 || "",
    address2: shippingAddr.line2 || undefined,
    city: shippingAddr.city || "",
    zip: shippingAddr.postal_code || "",
  };

  const lineItems = items
    .filter((item) => item.printifyProductId && item.printifyVariantId)
    .map((item) => ({
      product_id: item.printifyProductId!,
      variant_id: item.printifyVariantId!,
      quantity: item.quantity,
    }));

  if (lineItems.length === 0) {
    console.warn("[Stripe Webhook] No Printify-backed items in order", session.id);
    return;
  }

  const printifyOrder = await submitOrder({
    external_id: session.id,
    label: session.id.slice(-8),
    line_items: lineItems,
    shipping_method: 1,
    send_shipping_notification: true,
    address_to: address,
  });

  await sendToProduction(printifyOrder.id);
  console.log("[Stripe Webhook] Printify order created and sent to production:", printifyOrder.id);
}
