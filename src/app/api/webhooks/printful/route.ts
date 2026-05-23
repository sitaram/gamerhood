import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sendShippingNotification } from "@/lib/email";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  getOrderByPrintfulId,
  updateOrderTracking,
} from "@/lib/supabase/queries";
import type {
  PrintfulShipmentEventData,
  PrintfulWebhookEvent,
} from "@/lib/printful/client";

// Printful v2 webhook signing:
//   - HMAC-SHA256(rawBody, secretKey) === <hex from x-pf-webhook-signature>
//   - The secret key in our env is the **hex** representation Printful gives
//     us in the dashboard; per their docs we must hex-decode it before
//     feeding it to HMAC. (Their value is a 64-char hex string = 32 bytes.)
//
// We verify before parsing JSON to protect against pathological bodies.
function verifySignature(rawBody: string, headerSig: string | null): boolean {
  const secretHex = process.env.PRINTFUL_WEBHOOK_SECRET;
  if (!secretHex) {
    // Dev mode: no secret configured → accept everything. We log loudly so
    // this never accidentally ships to prod without verification on.
    console.warn(
      "[Printful Webhook] PRINTFUL_WEBHOOK_SECRET not set — accepting unsigned events.",
    );
    return true;
  }
  if (!headerSig) return false;

  let secret: Buffer;
  try {
    secret = Buffer.from(secretHex, "hex");
  } catch {
    console.error("[Printful Webhook] PRINTFUL_WEBHOOK_SECRET is not valid hex.");
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  // Length-equal check first — timingSafeEqual throws if buffers differ in size.
  if (expected.length !== headerSig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(headerSig));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const sig = request.headers.get("x-pf-webhook-signature");
  if (!verifySignature(rawBody, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PrintfulWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PrintfulWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "shipment_sent":
      case "shipment_delivered": {
        const data = event.data as PrintfulShipmentEventData;
        const supabase = getServiceClient();
        const newStatus =
          event.type === "shipment_delivered" ? "delivered" : "shipped";

        const printfulOrderId = String(data.order.id);

        // Persist tracking even if email fails so the buyer can see status
        // from /api/orders.
        if (data.shipment.tracking_number) {
          await updateOrderTracking(
            supabase,
            printfulOrderId,
            data.shipment.tracking_number,
            newStatus,
          ).catch((err) =>
            console.error("[Printful Webhook] tracking update error:", err),
          );
        }

        // Email the buyer when the shipment first goes out.
        if (event.type === "shipment_sent" && data.shipment.tracking_number) {
          const { data: orderRow, error } = await getOrderByPrintfulId(
            supabase,
            printfulOrderId,
          );
          if (error || !orderRow?.buyer_email) {
            console.warn(
              "[Printful Webhook] No buyer email for printful order",
              printfulOrderId,
            );
          } else {
            await sendShippingNotification(orderRow.buyer_email, {
              // Printful's payload doesn't break out a carrier name on the
              // shipment object directly — derive a sane label from the URL
              // host (USPS/UPS/FedEx are all encoded in the tracking URL).
              carrier: carrierFromUrl(data.shipment.tracking_url),
              trackingNumber: data.shipment.tracking_number,
              trackingUrl: data.shipment.tracking_url ?? "",
            }).catch((err) =>
              console.error("[Printful Webhook] shipping email error:", err),
            );
          }
        }
        break;
      }

      case "order_created":
      case "order_updated":
      case "order_failed":
      case "order_canceled":
        console.log(`[Printful Webhook] ${event.type}`, event.data);
        break;

      default:
        console.log(`[Printful Webhook] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error("[Printful Webhook] Error processing event:", err);
    // Still 200: we already verified the signature, so a 5xx would just
    // make Printful retry and we'd hit the same bug. Better to log and
    // investigate manually.
  }

  return NextResponse.json({ received: true });
}

function carrierFromUrl(url: string | undefined): string {
  if (!url) return "Carrier";
  const lower = url.toLowerCase();
  if (lower.includes("usps")) return "USPS";
  if (lower.includes("ups")) return "UPS";
  if (lower.includes("fedex")) return "FedEx";
  if (lower.includes("dhl")) return "DHL";
  return "Carrier";
}
