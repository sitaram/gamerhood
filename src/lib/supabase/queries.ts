import { SupabaseClient } from "@supabase/supabase-js";
import type { Product, Creator } from "@/lib/types";

// ── Mappers (DB row → app types) ──

type ProductRowWithProfile = {
  id: string;
  design_id: string;
  profile_id: string;
  title: string;
  description: string | null;
  product_type: string;
  base_price_cents: number;
  markup_cents: number;
  mockup_url: string | null;
  colors: string[] | null;
  sizes: string[] | null;
  is_published: boolean;
  printify_product_id: string | null;
  sales_count: number | null;
  created_at: string;
  profiles?: {
    id: string;
    display_name: string;
    slug: string;
    avatar_url: string | null;
    bio: string | null;
    level: number | null;
    xp: number | null;
  } | null;
};

function mapProfileToCreator(p: NonNullable<ProductRowWithProfile["profiles"]>): Creator {
  return {
    id: p.id,
    displayName: p.display_name,
    slug: p.slug,
    avatarUrl: p.avatar_url ?? "",
    bio: p.bio ?? "",
    level: p.level ?? 1,
    xp: p.xp ?? 0,
    totalSales: 0,
    totalDesigns: 0,
    joinedAt: "",
    badges: [],
  };
}

function mapProductRow(row: ProductRowWithProfile): Product {
  const basePrice = row.base_price_cents / 100;
  const markup = row.markup_cents / 100;
  return {
    id: row.id,
    designId: row.design_id,
    creatorId: row.profile_id,
    creator: row.profiles ? mapProfileToCreator(row.profiles) : undefined,
    title: row.title,
    description: row.description ?? "",
    productType: row.product_type as Product["productType"],
    basePrice,
    markup,
    price: basePrice + markup,
    mockupUrl: row.mockup_url ?? "",
    colors: row.colors ?? ["Default"],
    sizes: row.sizes ?? undefined,
    isPublished: row.is_published,
    createdAt: row.created_at,
    salesCount: row.sales_count ?? 0,
    printifyProductId: row.printify_product_id ?? undefined,
  };
}

// ── Designs ──

export interface DesignRow {
  id: string;
  profile_id: string;
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
    profile_id: string;
    title: string;
    image_url: string;
    prompt: string | null;
    style: string;
  },
) {
  return supabase.from("designs").insert(data).select().single();
}

export async function getDesignsByProfile(supabase: SupabaseClient, profileId: string) {
  return supabase
    .from("designs")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
}

export async function getDesignById(supabase: SupabaseClient, id: string) {
  return supabase.from("designs").select("*").eq("id", id).single();
}

// ── Products ──

export interface ProductRow {
  id: string;
  design_id: string;
  profile_id: string;
  title: string;
  description: string;
  product_type: string;
  base_price_cents: number;
  markup_cents: number;
  mockup_url: string;
  colors: string[];
  sizes: string[] | null;
  is_published: boolean;
  printify_product_id: string | null;
  created_at: string;
  sales_count: number;
}

export async function insertProduct(
  supabase: SupabaseClient,
  data: {
    design_id: string;
    profile_id: string;
    title: string;
    description: string;
    product_type: string;
    base_price_cents: number;
    markup_cents: number;
    mockup_url: string;
    colors: string[];
    sizes: string[] | null;
    is_published: boolean;
    printify_product_id: string | null;
  },
) {
  return supabase.from("products").insert(data).select().single();
}

export async function getProductsByProfile(supabase: SupabaseClient, profileId: string) {
  return supabase
    .from("products")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
}

export async function getPublishedProducts(supabase: SupabaseClient, limit = 100): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, profiles(id, display_name, slug, avatar_url, bio, level, xp)")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as ProductRowWithProfile[]).map(mapProductRow);
}

export async function getProductByIdWithCreator(
  supabase: SupabaseClient,
  id: string,
): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*, profiles(id, display_name, slug, avatar_url, bio, level, xp)")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return mapProductRow(data as ProductRowWithProfile);
}

export async function getPublishedProductsByProfile(
  supabase: SupabaseClient,
  profileId: string,
): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, profiles(id, display_name, slug, avatar_url, bio, level, xp)")
    .eq("profile_id", profileId)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as ProductRowWithProfile[]).map(mapProductRow);
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

// ── Parents ──

export interface ParentRow {
  id: string;
  auth_user_id: string;
  email: string;
  display_name: string;
  stripe_connect_id: string | null;
  stripe_onboarding_complete: boolean;
  consent_method: "credit_card" | "esign" | "id_verify" | null;
  consent_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function upsertParent(
  supabase: SupabaseClient,
  data: {
    auth_user_id: string;
    email: string;
    display_name: string;
  },
) {
  return supabase
    .from("parents")
    .upsert(data, { onConflict: "auth_user_id" })
    .select()
    .single();
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

export async function getProfileBySlug(supabase: SupabaseClient, slug: string) {
  return supabase
    .from("profiles")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
}

export async function getTrendingProfiles(supabase: SupabaseClient, limit = 4) {
  return supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function getProfileByParentId(supabase: SupabaseClient, parentId: string) {
  return supabase
    .from("profiles")
    .select("*")
    .eq("parent_id", parentId)
    .single();
}

/**
 * Look up the default profile for the currently-authenticated parent.
 * Joins parents → profiles via the auth user id.
 */
export async function getDefaultProfileForAuthUser(
  supabase: SupabaseClient,
  authUserId: string,
) {
  const { data: parent, error: parentErr } = await supabase
    .from("parents")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();

  if (parentErr || !parent) return { data: null, error: parentErr };

  return getProfileByParentId(supabase, parent.id);
}

export async function upsertProfile(
  supabase: SupabaseClient,
  data: {
    parent_id: string;
    display_name: string;
    slug: string;
    avatar_url?: string;
    bio?: string;
    is_active?: boolean;
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
