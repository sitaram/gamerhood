import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import {
  createOrder as createPrintfulOrder,
  confirmOrder as confirmPrintfulOrder,
  type PrintfulFileLayer,
  type PrintfulOrderItemCreate,
  type PrintfulRecipient,
} from "@/lib/printful/client";
import { getCatalogConfig } from "@/lib/printful/catalog";
import { parseStoredPlacement, placementLayerForProduct } from "@/lib/print/placement";
import { sendOrderConfirmation } from "@/lib/email";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  getOrderBySessionId,
  markOrderPaid,
  updateOrderPrintfulId,
} from "@/lib/supabase/queries";
import type { ProductType } from "@/lib/types";

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
      // Always 200 once we've recorded the event so Stripe doesn't retry the
      // whole pipeline (including duplicate Printful submissions). We log and
      // surface enough detail for ops to follow up.
      console.error("[Stripe Webhook] Error handling checkout.session.completed:", err);
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = getServiceClient();
  const buyerEmail = session.customer_details?.email ?? "";

  // ── Gather shipping. Stripe's TS type doesn't expose `shipping_details`
  // on Session yet so we narrow once at the top.
  const sessionAny = session as unknown as Record<string, Record<string, unknown> | undefined>;
  const shipping = sessionAny.shipping_details;
  const shippingAddr = shipping?.address as Record<string, string> | undefined;
  const shippingName = (shipping?.name as string | undefined) ?? null;

  // ── Mark the order paid first so downstream lookups work even if Printful
  // submission fails. We also stash the payment_intent so admins can refund
  // by intent id without going through Stripe's UI.
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const { data: paidOrder, error: markErr } = await markOrderPaid(
    supabase,
    session.id,
    {
      stripe_payment_id: paymentIntentId,
      shipping_name: shippingName,
      shipping_address: shippingAddr ?? null,
      buyer_email: buyerEmail || null,
    },
  );
  if (markErr) {
    console.warn(
      "[Stripe Webhook] No matching order in DB for session",
      session.id,
      "— continuing with fulfillment based on Stripe data.",
      markErr,
    );
  }

  // ── Pull line items + product info for Printful and the confirmation email.
  // If we have a DB order, prefer that (richer/safer). Otherwise read from
  // Stripe directly.
  const { data: orderWithItems } = paidOrder
    ? await getOrderBySessionId(supabase, session.id)
    : { data: null };

  type OrderWithItems = Awaited<ReturnType<typeof getOrderBySessionId>>["data"];
  const dbItems =
    (orderWithItems as OrderWithItems)?.order_items as
      | Array<{
          quantity: number;
          unit_price_cents: number;
          selected_color: string | null;
          selected_size: string | null;
          products: { title: string; mockup_url: string | null } | null;
          product_id: string;
        }>
      | undefined;

  // ── Submit to Printful.
  //
  // Order item shape (per /v2/orders):
  //   {
  //     source: "catalog",
  //     catalog_variant_id: <int>,           // SKU (size+color), from products row
  //     quantity, retail_price, name,
  //     placements: [{
  //       placement: "front" | "back" | …,   // from catalog config
  //       technique: "dtg" | "sublimation",  // from catalog config
  //       layers: [{ type: "file", url: <public design URL> }]
  //     }]
  //   }
  //
  // We need three things per item: the catalog_variant_id (on the product
  // row), the placement+technique (from env-driven catalog config keyed
  // by product_type), and the design's public URL (designs.image_url
  // post-publish). Items missing any of these get skipped — the storefront
  // purchase is still valid; ops can fulfill manually if needed.
  if (!shippingAddr) {
    console.error("[Stripe Webhook] No shipping address on session", session.id);
  } else if (paidOrder && dbItems && dbItems.length > 0) {
    const productIds = dbItems.map((i) => i.product_id);

    // Pull product → variant id and product → design.image_url in one trip.
    const { data: products } = await supabase
      .from("products")
      .select(
        "id, product_type, printful_catalog_variant_id, title, print_placement, designs ( image_url )",
      )
      .in("id", productIds);

    type ProductWithDesign = {
      id: string;
      product_type: ProductType;
      printful_catalog_variant_id: number | null;
      title: string;
      print_placement?: unknown;
      designs?: { image_url: string | null } | null;
    };
    const productsById = new Map<string, ProductWithDesign>(
      (products as unknown as ProductWithDesign[] | null)?.map((p) => [p.id, p]) ?? [],
    );

    const orderItems: PrintfulOrderItemCreate[] = [];
    for (const i of dbItems) {
      const p = productsById.get(i.product_id);
      if (!p) continue;
      if (!p.printful_catalog_variant_id) {
        console.warn(
          `[Stripe Webhook] Product ${p.id} has no printful_catalog_variant_id; skipping fulfillment for this line.`,
        );
        continue;
      }

      const designUrl = p.designs?.image_url;
      if (!designUrl || designUrl.startsWith("data:")) {
        console.warn(
          `[Stripe Webhook] Product ${p.id} design has no public URL (still data:?); skipping fulfillment for this line.`,
        );
        continue;
      }

      const catalog = getCatalogConfig(p.product_type);
      if (!catalog) {
        console.warn(
          `[Stripe Webhook] No catalog config for product_type=${p.product_type}; skipping line.`,
        );
        continue;
      }

      const storedPlacement = parseStoredPlacement(p.print_placement);
      const pfPos = placementLayerForProduct(p.product_type, catalog, storedPlacement);
      const layer: PrintfulFileLayer = { type: "file", url: designUrl };
      if (pfPos) {
        layer.position = pfPos;
      }

      orderItems.push({
        source: "catalog",
        catalog_variant_id: p.printful_catalog_variant_id,
        quantity: i.quantity,
        external_id: p.id,
        name: p.title,
        retail_price: (i.unit_price_cents / 100).toFixed(2),
        placements: [
          {
            placement: catalog.placement,
            technique: catalog.technique,
            layers: [layer],
          },
        ],
      });
    }

    if (orderItems.length === 0) {
      console.warn(
        "[Stripe Webhook] No Printful-eligible items in order",
        session.id,
      );
    } else {
      const recipient: PrintfulRecipient = {
        name: shippingName ?? "Customer",
        address1: shippingAddr.line1 || "",
        address2: shippingAddr.line2 || undefined,
        city: shippingAddr.city || "",
        state_code: shippingAddr.state || undefined,
        country_code: shippingAddr.country || "US",
        zip: shippingAddr.postal_code || "",
        email: buyerEmail || undefined,
        phone: typeof session.customer_details?.phone === "string"
          ? session.customer_details.phone
          : undefined,
      };

      try {
        // Two-step: create draft → confirm. Lets us catch validation issues
        // (bad address, unprintable artwork) before the wallet is charged.
        const draft = await createPrintfulOrder({
          external_id: session.id,
          shipping: "STANDARD",
          recipient,
          order_items: orderItems,
        });
        const confirmed = await confirmPrintfulOrder(draft.id);
        await updateOrderPrintfulId(supabase, session.id, String(confirmed.id));
        console.log("[Stripe Webhook] Printful order confirmed:", confirmed.id);
      } catch (err) {
        console.error("[Stripe Webhook] Printful order submit failed:", err);
      }
    }
  }

  // ── Confirmation email with real item names + prices.
  if (buyerEmail) {
    const emailItems =
      (dbItems ?? []).map((i) => ({
        name: i.products?.title ?? "Item",
        quantity: i.quantity,
        price: i.unit_price_cents,
      })) ?? [];

    await sendOrderConfirmation(buyerEmail, {
      sessionId: session.id,
      total: session.amount_total ?? 0,
      items: emailItems.length > 0
        ? emailItems
        : // Fallback: nothing in DB, summarize as one bundle line.
          [
            {
              name: `Gamerhood order (${session.id.slice(-8)})`,
              quantity: 1,
              price: session.amount_total ?? 0,
            },
          ],
    }).catch((err) =>
      console.error("[Stripe Webhook] Email send error:", err),
    );
  }
}
