import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { getServiceClient } from "@/lib/supabase/admin";
import { getOrderBySessionId } from "@/lib/supabase/queries";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 },
    );
  }

  try {
    // ── Prefer the DB row (set by the Stripe webhook). It has tracking and
    // canonical item names. Fall back to Stripe if the webhook hasn't fired
    // yet — common race when the buyer lands on /checkout/success.
    const supabase = getServiceClient();
    const { data: order } = await getOrderBySessionId(supabase, sessionId);

    if (order) {
      type OrderItem = {
        quantity: number;
        unit_price_cents: number;
        selected_color: string | null;
        selected_size: string | null;
        products?: { title: string; mockup_url: string | null } | null;
      };
      const items = (order.order_items as OrderItem[] | null) ?? [];
      return NextResponse.json({
        id: order.stripe_session_id,
        status: order.status,
        customerEmail: order.buyer_email,
        shippingName: order.shipping_name,
        shippingAddress: order.shipping_address,
        amountTotal: order.total_cents,
        items: items.map((item) => ({
          description: item.products?.title ?? "Item",
          quantity: item.quantity,
          amountTotal: item.unit_price_cents * item.quantity,
          imageUrl: item.products?.mockup_url ?? null,
        })),
        createdAt: order.created_at,
        printfulOrderId: order.printful_order_id,
        trackingNumber: order.tracking_number,
        source: "db" as const,
      });
    }

    // ── Fallback: webhook race. Verify the session is real with Stripe so
    // we don't tell the buyer "all good" for a session id they made up.
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "payment_intent"],
    });

    const sessionObj = session as unknown as Record<string, unknown>;
    const shippingDetails = sessionObj.shipping_details as
      | { name?: string; address?: Record<string, string> }
      | undefined;

    return NextResponse.json({
      id: session.id,
      status: session.payment_status,
      customerEmail: session.customer_details?.email,
      shippingName: shippingDetails?.name,
      shippingAddress: shippingDetails?.address,
      amountTotal: session.amount_total,
      items: session.line_items?.data.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        amountTotal: item.amount_total,
      })),
      createdAt: new Date((session.created || 0) * 1000).toISOString(),
      source: "stripe" as const,
    });
  } catch (err) {
    console.error("[Orders] Error retrieving session:", err);
    return NextResponse.json(
      { error: "Failed to retrieve order" },
      { status: 500 },
    );
  }
}
