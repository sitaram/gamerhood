// Printful API v2 client.
//
// We deliberately avoid the v1 endpoints (api.printful.com/v1/*) — Printful
// is winding them down and the v2 surface is both cleaner and smaller for
// our flow:
//
//   - We don't create "sync products" (those exist for connecting
//     storefronts like Shopify/Etsy). Our store is the source of truth.
//   - We don't pre-upload print files. Printful's order endpoint accepts a
//     plain `url` per layer and fetches the asset itself, so we just point
//     at the public Supabase Storage URL we minted at publish time.
//
// All requests authenticate with a Bearer token. Account-level tokens also
// need `X-PF-Store-Id`; private store tokens don't.

const BASE_URL = "https://api.printful.com/v2";
/**
 * Some Printful surfaces only exist on v1 (the mockup-generator templates
 * endpoint, in particular) — v2 hasn't shipped an equivalent for the
 * pixel-space print-area coordinates we need to draw an accurate cyan
 * frame on the rendered flat mockup. We pin the v1 base URL here so the
 * exception is explicit instead of being string-concatenated at each call
 * site.
 */
const BASE_URL_V1 = "https://api.printful.com";

function headers(): HeadersInit {
  const token = process.env.PRINTFUL_API_TOKEN;
  if (!token) throw new Error("PRINTFUL_API_TOKEN is not set");
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const storeId = process.env.PRINTFUL_STORE_ID;
  if (storeId) h["X-PF-Store-Id"] = storeId;
  return h;
}

export async function printfulRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Printful API ${res.status}: ${body || res.statusText}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

/**
 * Hit a v1-only Printful endpoint. Used exclusively for the mockup-
 * generator templates lookup (`/mockup-generator/templates/{product_id}`)
 * which exposes pixel-space `print_area_top/left/width/height` for each
 * variant + placement — data v2 doesn't expose yet. Same auth headers as
 * v2; only the base URL changes.
 */
export async function printfulRequestV1<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL_V1}${path}`, {
    ...options,
    headers: { ...headers(), ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Printful API v1 ${res.status}: ${body || res.statusText}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  return printfulRequest<T>(path, options);
}

export function isPrintfulConfigured(): boolean {
  return Boolean(process.env.PRINTFUL_API_TOKEN);
}

// ── Orders ──────────────────────────────────────────────────────────────────
//
// v2 order lifecycle:
//   draft   → created, not yet charged, fully editable
//   pending → after Confirm; charged; about to enter fulfillment
//   inprocess / partial / fulfilled / failed / canceled
//
// We always create draft orders, then confirm immediately. Two-step lets us
// catch validation errors before the card is charged on Printful's side.

export interface PrintfulRecipient {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code?: string;
  state_name?: string;
  country_code: string;
  country_name?: string;
  zip: string;
  phone?: string;
  email?: string;
}

/**
 * A single design layer. For our use case we always pass a publicly-fetchable
 * URL (Supabase Storage public bucket). Printful fetches the file
 * asynchronously and rejects the order if the URL turns out to be invalid.
 */
export interface PrintfulFileLayer {
  type: "file";
  url: string;
  /** When set, places the file within the placement print area (see Printful API v2). */
  position?: {
    area_width: number;
    area_height: number;
    width: number;
    height: number;
    left: number;
    top: number;
  };
}

export interface PrintfulPlacement {
  /** e.g. "front", "back", "left_sleeve". Per-product list lives in the catalog. */
  placement: string;
  /** e.g. "dtg", "sublimation", "embroidery". Driven by env-config. */
  technique: string;
  layers: PrintfulFileLayer[];
}

export interface PrintfulOrderItemCreate {
  source: "catalog";
  catalog_variant_id: number;
  quantity: number;
  /** Stable identifier we can read back; we use our internal product id. */
  external_id?: string;
  /** Sticker price the buyer paid, for Printful's records (decimal string). */
  retail_price?: string;
  name?: string;
  placements: PrintfulPlacement[];
}

export interface PrintfulOrderCreate {
  /** Stable id from our side (we use the Stripe session id). */
  external_id: string;
  /** Shipping speed: "STANDARD" | "EXPRESS" | etc. */
  shipping?: string;
  recipient: PrintfulRecipient;
  order_items: PrintfulOrderItemCreate[];
}

export interface PrintfulOrder {
  id: number;
  external_id: string | null;
  store_id: number;
  status: string;
  created_at: string;
  updated_at: string;
  recipient: PrintfulRecipient;
  costs?: { total?: string; subtotal?: string; shipping?: string };
  order_items?: { id: number }[];
}

/**
 * Create a draft order. Costs come back populated once Printful finishes its
 * async pricing calc (`costs.calculation_status`).
 */
export async function createOrder(
  data: PrintfulOrderCreate,
): Promise<PrintfulOrder> {
  const res = await request<{ data: PrintfulOrder }>("/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

/**
 * Move an order from `draft` to `pending`. After this point Printful will
 * charge our wallet and start fulfillment.
 */
export async function confirmOrder(orderId: number): Promise<PrintfulOrder> {
  const res = await request<{ data: PrintfulOrder }>(
    `/orders/${orderId}/confirmation`,
    { method: "POST" },
  );
  return res.data;
}

export async function getOrder(orderId: number): Promise<PrintfulOrder> {
  const res = await request<{ data: PrintfulOrder }>(`/orders/${orderId}`);
  return res.data;
}

// ── Webhook payload types ──────────────────────────────────────────────────
//
// We only handle the events we actually wire up; anything else is logged and
// dropped. The full schema is at https://developers.printful.com/docs/v2-preview/

export type PrintfulWebhookEventType =
  | "shipment_sent"
  | "shipment_delivered"
  | "shipment_returned"
  | "shipment_canceled"
  | "shipment_out_of_stock"
  | "order_created"
  | "order_updated"
  | "order_failed"
  | "order_canceled";

export interface PrintfulWebhookEvent<TData = unknown> {
  type: PrintfulWebhookEventType;
  occurred_at: string;
  retries: number;
  store_id: number;
  data: TData;
}

export interface PrintfulShipmentEventData {
  shipment: {
    id: number;
    status: string;
    tracking_number?: string;
    tracking_url?: string;
    shipped_at?: string;
    delivered_at?: string;
  };
  order: {
    id: number;
    external_id: string | null;
    status: string;
  };
}

export interface PrintfulOrderEventData {
  order: PrintfulOrder;
}
