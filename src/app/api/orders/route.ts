import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 },
    );
  }

  try {
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
      printifyOrderId: session.metadata?.printify_order_id,
    });
  } catch (err) {
    console.error("[Orders] Error retrieving session:", err);
    return NextResponse.json(
      { error: "Failed to retrieve order" },
      { status: 500 },
    );
  }
}
