import { SupabaseClient } from "@supabase/supabase-js";

// ── Designs ──

export interface DesignRow {
  id: string;
  creator_id: string;
  title: string;
  image_url: string;
  prompt: string | null;
  style: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export async function insertDesign(
  supabase: SupabaseClient,
  data: {
    creator_id: string;
    title: string;
    image_url: string;
    prompt: string | null;
    style: string;
  },
) {
  return supabase.from("designs").insert(data).select().single();
}

export async function getDesignsByCreator(supabase: SupabaseClient, creatorId: string) {
  return supabase
    .from("designs")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });
}

// ── Products ──

export interface ProductRow {
  id: string;
  design_id: string;
  creator_id: string;
  title: string;
  description: string;
  product_type: string;
  base_price: number;
  markup: number;
  price: number;
  mockup_url: string;
  colors: string[];
  sizes: string[] | null;
  is_published: boolean;
  printify_product_id: string | null;
  printify_variant_id: number | null;
  created_at: string;
  sales_count: number;
}

export async function insertProduct(
  supabase: SupabaseClient,
  data: {
    design_id: string;
    creator_id: string;
    title: string;
    description: string;
    product_type: string;
    base_price: number;
    markup: number;
    price: number;
    mockup_url: string;
    colors: string[];
    sizes: string[] | null;
    is_published: boolean;
    printify_product_id: string | null;
    printify_variant_id: number | null;
  },
) {
  return supabase.from("products").insert(data).select().single();
}

export async function getProductsByCreator(supabase: SupabaseClient, creatorId: string) {
  return supabase
    .from("products")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });
}

export async function getPublishedProducts(supabase: SupabaseClient, limit = 50) {
  return supabase
    .from("products")
    .select("*, profiles(display_name, slug, avatar_url)")
    .eq("is_published", true)
    .order("sales_count", { ascending: false })
    .limit(limit);
}

// ── Orders ──

export interface OrderRow {
  id: string;
  buyer_email: string;
  stripe_session_id: string;
  printify_order_id: string | null;
  total_amount: number;
  platform_fee: number;
  status: "pending" | "processing" | "shipped" | "delivered";
  shipping_name: string | null;
  shipping_address: Record<string, string> | null;
  tracking_number: string | null;
  created_at: string;
}

export async function insertOrder(
  supabase: SupabaseClient,
  data: {
    buyer_email: string;
    stripe_session_id: string;
    total_amount: number;
    platform_fee: number;
    shipping_name: string | null;
    shipping_address: Record<string, string> | null;
  },
) {
  return supabase.from("orders").insert(data).select().single();
}

export async function updateOrderPrintifyId(
  supabase: SupabaseClient,
  stripeSessionId: string,
  printifyOrderId: string,
) {
  return supabase
    .from("orders")
    .update({ printify_order_id: printifyOrderId, status: "processing" })
    .eq("stripe_session_id", stripeSessionId);
}

export async function updateOrderTracking(
  supabase: SupabaseClient,
  printifyOrderId: string,
  trackingNumber: string,
  status: "shipped" | "delivered",
) {
  return supabase
    .from("orders")
    .update({ tracking_number: trackingNumber, status })
    .eq("printify_order_id", printifyOrderId);
}

export async function getOrdersByCreator(supabase: SupabaseClient, creatorId: string) {
  return supabase
    .from("orders")
    .select("*, order_items!inner(product_id, products!inner(creator_id))")
    .eq("order_items.products.creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(20);
}

// ── Profiles ──

export interface ProfileRow {
  id: string;
  parent_id: string;
  display_name: string;
  slug: string;
  avatar_url: string;
  bio: string;
  level: number;
  xp: number;
  total_sales: number;
  total_designs: number;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  created_at: string;
}

export async function getProfile(supabase: SupabaseClient, userId: string) {
  return supabase
    .from("profiles")
    .select("*")
    .eq("parent_id", userId)
    .single();
}

export async function upsertProfile(
  supabase: SupabaseClient,
  data: {
    parent_id: string;
    display_name: string;
    slug: string;
    avatar_url?: string;
    bio?: string;
  },
) {
  return supabase.from("profiles").upsert(data, { onConflict: "parent_id" }).select().single();
}

export async function updateProfileStripe(
  supabase: SupabaseClient,
  parentId: string,
  stripeAccountId: string,
  onboardingComplete: boolean,
) {
  return supabase
    .from("profiles")
    .update({
      stripe_account_id: stripeAccountId,
      stripe_onboarding_complete: onboardingComplete,
    })
    .eq("parent_id", parentId);
}
