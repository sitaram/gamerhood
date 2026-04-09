import { NextRequest, NextResponse } from "next/server";
import { sendShippingNotification } from "@/lib/email";

interface PrintifyShipmentEvent {
  id: string;
  type: string;
  created_at: string;
  resource: {
    id: string;
    data: {
      order: {
        id: string;
        status: string;
        shipments: {
          carrier: string;
          number: string;
          url: string;
          delivered_at: string | null;
        }[];
      };
    };
  };
}

export async function POST(request: NextRequest) {
  const secret = process.env.PRINTIFY_WEBHOOK_SECRET;
  if (secret) {
    const headerSecret = request.headers.get("x-pfy-signature") ?? request.headers.get("authorization");
    if (headerSecret !== secret) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let event: PrintifyShipmentEvent;
  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "order:shipment:created":
      case "order:shipment:delivered": {
        const { order } = event.resource.data;
        const shipment = order.shipments?.[0];
        console.log(
          `[Printify Webhook] Order ${order.id} — status: ${order.status}` +
            (shipment ? `, tracking: ${shipment.carrier} ${shipment.number}` : ""),
        );

        // TODO: look up buyer email from Supabase orders table using order.id
        // For now, shipping notification requires the buyer email to be resolved from DB
        if (shipment && event.type === "order:shipment:created") {
          // When Supabase is connected: query the order, get buyer email, send notification
          // const buyerEmail = await getBuyerEmailByPrintifyOrderId(order.id);
          // if (buyerEmail) {
          //   await sendShippingNotification(buyerEmail, {
          //     carrier: shipment.carrier,
          //     trackingNumber: shipment.number,
          //     trackingUrl: shipment.url,
          //   });
          // }
          void sendShippingNotification;
        }
        break;
      }

      case "order:created":
      case "order:updated":
        console.log(`[Printify Webhook] ${event.type} — order ${event.resource.id}`);
        break;

      default:
        console.log(`[Printify Webhook] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error("[Printify Webhook] Error processing event:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
