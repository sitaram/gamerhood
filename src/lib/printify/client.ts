const BASE_URL = "https://api.printify.com/v1";

function headers(): HeadersInit {
  const token = process.env.PRINTIFY_API_TOKEN;
  if (!token) throw new Error("PRINTIFY_API_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function shopId(): string {
  const id = process.env.PRINTIFY_SHOP_ID;
  if (!id) throw new Error("PRINTIFY_SHOP_ID is not set");
  return id;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Printify API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Uploads ──

export interface PrintifyImage {
  id: string;
  file_name: string;
  height: number;
  width: number;
  size: number;
  mime_type: string;
  preview_url: string;
  upload_time: string;
}

export async function uploadImage(
  fileName: string,
  imageUrl: string,
): Promise<PrintifyImage> {
  return request<PrintifyImage>("/uploads/images.json", {
    method: "POST",
    body: JSON.stringify({ file_name: fileName, url: imageUrl }),
  });
}

// ── Catalog ──

export interface Blueprint {
  id: number;
  title: string;
  description: string;
  brand: string;
  model: string;
  images: string[];
}

export interface PrintProvider {
  id: number;
  title: string;
  location: { address1: string; city: string; country: string; region: string; zip: string };
}

export interface Variant {
  id: number;
  title: string;
  options: Record<string, string>;
  placeholders: { position: string; height: number; width: number }[];
}

export interface ShippingInfo {
  handling_time: { value: number; unit: string };
  profiles: {
    variant_ids: number[];
    first_item: { cost: number; currency: string };
    additional_items: { cost: number; currency: string };
    countries: string[];
  }[];
}

export async function listBlueprints(): Promise<Blueprint[]> {
  return request<Blueprint[]>("/catalog/blueprints.json");
}

export async function getBlueprintProviders(
  blueprintId: number,
): Promise<PrintProvider[]> {
  return request<PrintProvider[]>(
    `/catalog/blueprints/${blueprintId}/print_providers.json`,
  );
}

type BlueprintVariant = {
  id: number;
  title: string;
  options: number[];
  placeholders: { position: string; height: number; width: number }[];
};

export async function getBlueprintVariants(
  blueprintId: number,
  providerId: number,
): Promise<BlueprintVariant[]> {
  const data = await request<{ variants: BlueprintVariant[] }>(
    `/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`,
  );
  return data.variants;
}

export async function getShippingInfo(
  blueprintId: number,
  providerId: number,
): Promise<ShippingInfo> {
  return request<ShippingInfo>(
    `/catalog/blueprints/${blueprintId}/print_providers/${providerId}/shipping.json`,
  );
}

// ── Products ──

export interface PrintifyProductCreate {
  title: string;
  description: string;
  blueprint_id: number;
  print_provider_id: number;
  variants: { id: number; price: number; is_enabled: boolean }[];
  print_areas: {
    variant_ids: number[];
    placeholders: {
      position: string;
      images: { id: string; x: number; y: number; scale: number; angle: number }[];
    }[];
  }[];
}

export interface PrintifyProduct {
  id: string;
  title: string;
  description: string;
  variants: {
    id: number;
    sku: string;
    cost: number;
    price: number;
    title: string;
    is_enabled: boolean;
    is_available: boolean;
  }[];
  images: { src: string; variant_ids: number[]; position: string; is_default: boolean }[];
  blueprint_id: number;
  print_provider_id: number;
}

export async function createProduct(
  data: PrintifyProductCreate,
): Promise<PrintifyProduct> {
  return request<PrintifyProduct>(`/shops/${shopId()}/products.json`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getProduct(productId: string): Promise<PrintifyProduct> {
  return request<PrintifyProduct>(
    `/shops/${shopId()}/products/${productId}.json`,
  );
}

export async function publishProduct(productId: string): Promise<void> {
  await request(`/shops/${shopId()}/products/${productId}/publish.json`, {
    method: "POST",
    body: JSON.stringify({
      title: true,
      description: true,
      images: true,
      variants: true,
      tags: true,
    }),
  });
}

// ── Orders ──

export interface PrintifyOrderAddress {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
}

export interface PrintifyOrderLineItem {
  product_id: string;
  variant_id: number;
  quantity: number;
}

export interface PrintifyOrderLineItemByImage {
  print_provider_id: number;
  blueprint_id: number;
  variant_id: number;
  print_areas: { front: string };
  quantity: number;
}

export interface PrintifyOrderCreate {
  external_id: string;
  label: string;
  line_items: (PrintifyOrderLineItem | PrintifyOrderLineItemByImage)[];
  shipping_method: number;
  send_shipping_notification: boolean;
  address_to: PrintifyOrderAddress;
}

export interface PrintifyOrder {
  id: string;
  status: string;
  line_items: {
    product_id: string;
    quantity: number;
    variant_id: number;
    cost: number;
    shipping_cost: number;
    status: string;
  }[];
  shipments?: {
    carrier: string;
    number: string;
    url: string;
    delivered_at: string | null;
  }[];
  total_price: number;
  total_shipping: number;
  created_at: string;
}

export async function submitOrder(
  data: PrintifyOrderCreate,
): Promise<{ id: string }> {
  return request<{ id: string }>(`/shops/${shopId()}/orders.json`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function sendToProduction(orderId: string): Promise<PrintifyOrder> {
  return request<PrintifyOrder>(
    `/shops/${shopId()}/orders/${orderId}/send_to_production.json`,
    { method: "POST" },
  );
}

export async function getOrder(orderId: string): Promise<PrintifyOrder> {
  return request<PrintifyOrder>(
    `/shops/${shopId()}/orders/${orderId}.json`,
  );
}

// ── Webhooks ──

export interface PrintifyWebhookEvent {
  id: string;
  type: string;
  created_at: string;
  resource: {
    id: string;
    type: string;
    data: Record<string, unknown>;
  };
}
