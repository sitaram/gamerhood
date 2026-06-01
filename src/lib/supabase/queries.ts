import { SupabaseClient } from "@supabase/supabase-js";
import type { Product, Creator, ProductType, PrintfulCatalogMeta } from "@/lib/types";
import { parseStoredPlacement } from "@/lib/print/placement";
import { getDisplayAvatar } from "@/lib/profile-avatar";

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
  printful_catalog_variant_id: number | null;
  sales_count: number | null;
  created_at: string;
  tags: string[] | null;
  category: string | null;
  seo_description: string | null;
  print_placement?: unknown | null;
  printful_catalog_product_id?: number | null;
  printful_catalog_meta?: unknown;
  designs?: { image_url: string } | null;
  profiles?: {
    id: string;
    display_name: string;
    slug: string;
    avatar_url: string | null;
    bio: string | null;
    level: number | null;
    xp: number | null;
    parents?: {
      stripe_connect_id: string | null;
      stripe_onboarding_complete: boolean | null;
    } | null;
  } | null;
};

/** Storefront/browse grids — no nested `parents` (RLS hides it from guests; avoids heavy embeds). */
const PRODUCT_LISTING_SELECT = `
  *,
  profiles (
    id, display_name, slug, avatar_url, bio, level, xp
  ),
  designs ( image_url )
`;

/** Checkout + PDP — Stripe Connect IDs live on parents. */
const PRODUCT_WITH_CREATOR_SELECT = `
  *,
  profiles (
    id, display_name, slug, avatar_url, bio, level, xp,
    parents ( stripe_connect_id, stripe_onboarding_complete )
  ),
  designs ( image_url )
`;

function parsePrintfulCatalogMeta(raw: unknown): PrintfulCatalogMeta | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Partial<PrintfulCatalogMeta>;
  if (typeof o.catalogProductId !== "number" || typeof o.catalogVariantId !== "number") return undefined;
  return raw as PrintfulCatalogMeta;
}

function mapProfileToCreator(p: NonNullable<ProductRowWithProfile["profiles"]>): Creator {
  return {
    id: p.id,
    displayName: p.display_name,
    slug: p.slug,
    // Always a renderable url — falls back to a stable default-axolotl
    // pick (per `getDisplayAvatar`) so creator-attribution surfaces never
    // have to special-case "no photo uploaded yet".
    avatarUrl: getDisplayAvatar({ id: p.id, avatar_url: p.avatar_url }),
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
  // Only forward the Connect account if onboarding is fully complete; otherwise
  // payouts would fail and Stripe Checkout would error before payment.
  const parents = row.profiles?.parents;
  const creatorStripeAccountId =
    parents?.stripe_onboarding_complete && parents.stripe_connect_id
      ? parents.stripe_connect_id
      : undefined;

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
    printfulCatalogVariantId: row.printful_catalog_variant_id ?? undefined,
    tags: row.tags?.length ? row.tags : undefined,
    category: row.category ?? undefined,
    seoDescription: row.seo_description ?? undefined,
    printfulCatalogMeta: parsePrintfulCatalogMeta(row.printful_catalog_meta),
    creatorStripeAccountId,
    designImageUrl: row.designs?.image_url ?? undefined,
    printPlacement: parseStoredPlacement(row.print_placement),
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
  moderation_notes: string | null;
  content_safe: boolean | null;
  copyright_clear: boolean | null;
  created_at: string;
  /**
   * Alpha-channel result; null = "not yet checked". Computed by
   * `detectDesignTransparency` (sharp) at upload/generate time and
   * back-filled lazily by the edit screen for legacy rows.
   */
  has_transparency: boolean | null;
  /** True when the creator originally uploaded SVG (stored raster is PNG). */
  uploaded_as_svg?: boolean | null;
}

export async function insertDesign(
  supabase: SupabaseClient,
  data: {
    profile_id: string;
    title: string;
    image_url: string;
    prompt: string | null;
    style: string;
    status?: "pending" | "approved" | "rejected";
    moderation_notes?: string | null;
    content_safe?: boolean | null;
    /**
     * Alpha-channel check result (column added in migration 031). Null when
     * the caller hasn't run the check yet — the design's edit screen will
     * lazy-fill from the public URL the first time it sees a null.
     */
    has_transparency?: boolean | null;
    uploaded_as_svg?: boolean | null;
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

/** Paginated library listing — cursor is the prior page's last `created_at` ISO string. */
export async function getDesignsByProfilePaginated(
  supabase: SupabaseClient,
  profileId: string,
  opts: { limit: number; cursor?: string | null },
) {
  const limit = Math.min(Math.max(1, opts.limit), 48);
  let query = supabase
    .from("designs")
    .select("id, title, prompt, style, image_url, created_at, uploaded_as_svg")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (opts.cursor) {
    query = query.lt("created_at", opts.cursor);
  }

  return query;
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
  printful_catalog_variant_id: number | null;
  created_at: string;
  sales_count: number;
  tags: string[] | null;
  category: string | null;
  seo_description: string | null;
  /** Framing for Printful file layer ({ zoom, panX, panY, imageAspect }) */
  print_placement?: unknown | null;
  printful_catalog_product_id?: number | null;
  printful_catalog_meta?: unknown | null;
  /** Snapshot of the Printful wholesale cost at publish time (cents). */
  wholesale_price_cents?: number | null;
  /** US-domestic shipping estimate snapshot at publish time (cents). */
  shipping_estimate_cents?: number | null;
  /**
   * Storefront the listing currently lives on. Nullable for legacy rows
   * published before multi-storefront landed; readers should fall back
   * to the owner's default storefront when this is null.
   */
  storefront_id?: string | null;
  /**
   * Joined columns from `designs` — present when the SELECT requested
   * them. `has_transparency` is populated for designs created after
   * migration 031 and lazy-filled on first read for legacy rows.
   */
  designs?: {
    id?: string;
    image_url: string;
    has_transparency?: boolean | null;
    uploaded_as_svg?: boolean | null;
  } | null;
}

export async function insertProduct(
  supabase: SupabaseClient,
  data: {
    design_id: string;
    profile_id: string;
    /**
     * Storefront the product belongs to. Nullable in schema for safe
     * rollout, but the publish endpoint always sets it now. Readers
     * should treat null as "owner's default storefront" via
     * `storefronts.is_default = true`.
     */
    storefront_id?: string | null;
    title: string;
    description: string;
    product_type: string;
    base_price_cents: number;
    markup_cents: number;
    mockup_url: string;
    colors: string[];
    sizes: string[] | null;
    is_published: boolean;
    printful_catalog_variant_id?: number | null;
    tags?: string[] | null;
    category?: string | null;
    seo_description?: string | null;
    print_placement?: import("@/lib/print/placement").StoredPrintPlacement | null;
    printful_catalog_product_id?: number | null;
    printful_catalog_meta?: PrintfulCatalogMeta | null;
    wholesale_price_cents?: number | null;
    shipping_estimate_cents?: number | null;
  },
) {
  return supabase.from("products").insert(data).select().single();
}

export async function getProductsByProfile(supabase: SupabaseClient, profileId: string) {
  return supabase
    .from("products")
    .select(
      `
      *,
      designs ( image_url )
    `,
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
}

export async function getPublishedProducts(supabase: SupabaseClient, limit = 100): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_LISTING_SELECT)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[getPublishedProducts]", error);
    return [];
  }
  if (!data) return [];
  return (data as unknown as ProductRowWithProfile[]).map(mapProductRow);
}

export async function getProductByIdWithCreator(
  supabase: SupabaseClient,
  id: string,
): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_WITH_CREATOR_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return mapProductRow(data as unknown as ProductRowWithProfile);
}

export async function getPublishedProductsByProfile(
  supabase: SupabaseClient,
  profileId: string,
): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_LISTING_SELECT)
    .eq("profile_id", profileId)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getPublishedProductsByProfile]", profileId, error);
    return [];
  }
  if (!data) return [];
  return (data as unknown as ProductRowWithProfile[]).map(mapProductRow);
}

/**
 * Published products for marketplace browse: `/{category}/{merch}`.
 * Matches products where `category` equals the slug OR `tags` contains the slug.
 */
export async function getPublishedProductsForBrowse(
  supabase: SupabaseClient,
  categorySlug: string,
  productType: ProductType,
  limit = 200,
): Promise<Product[]> {
  const cat = categorySlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (!cat) return [];

  const q = () =>
    supabase
      .from("products")
      .select(PRODUCT_LISTING_SELECT)
      .eq("is_published", true)
      .eq("product_type", productType);

  const { data: byCategory } = await q()
    .eq("category", cat)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data: byTag } = await q()
    .contains("tags", [cat])
    .order("created_at", { ascending: false })
    .limit(limit);

  const seen = new Set<string>();
  const merged: ProductRowWithProfile[] = [];
  for (const row of [...(byCategory ?? []), ...(byTag ?? [])] as ProductRowWithProfile[]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  merged.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return merged.map(mapProductRow);
}

// ── Browse categories (SEO landing `/{slug}/{merch}`) ────────────────────────

export interface BrowseCategoryRow {
  id: string;
  slug: string;
  name: string;
  seo_title: string | null;
  seo_description: string | null;
  keywords: string[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function getBrowseCategoryBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<BrowseCategoryRow | null> {
  const s = slug.trim().toLowerCase();
  if (!s) return null;
  const { data, error } = await supabase
    .from("browse_categories")
    .select("*")
    .eq("slug", s)
    .maybeSingle();

  if (error || !data) return null;
  return data as BrowseCategoryRow;
}

export async function listBrowseCategories(
  supabase: SupabaseClient,
): Promise<BrowseCategoryRow[]> {
  const { data, error } = await supabase
    .from("browse_categories")
    .select("*")
    .order("name", { ascending: true });

  if (error || !data) return [];
  return data as BrowseCategoryRow[];
}

// ── Orders ──

export interface OrderRow {
  id: string;
  buyer_email: string;
  stripe_session_id: string | null;
  stripe_payment_id: string | null;
  printful_order_id: string | null;
  total_cents: number;
  platform_fee_cents: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  shipping_name: string | null;
  shipping_address: Record<string, string> | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemInsert {
  order_id: string;
  product_id: string;
  profile_id: string;
  quantity: number;
  unit_price_cents: number;
  creator_earnings_cents: number;
  selected_color?: string | null;
  selected_size?: string | null;
}

export async function insertOrder(
  supabase: SupabaseClient,
  data: {
    buyer_email: string;
    stripe_session_id: string;
    total_cents: number;
    platform_fee_cents: number;
    shipping_name?: string | null;
    shipping_address?: Record<string, string> | null;
    status?: OrderRow["status"];
  },
) {
  return supabase.from("orders").insert(data).select().single();
}

export async function insertOrderItems(
  supabase: SupabaseClient,
  items: OrderItemInsert[],
) {
  if (items.length === 0) return { data: [], error: null };
  return supabase.from("order_items").insert(items).select();
}

export async function getOrderBySessionId(
  supabase: SupabaseClient,
  stripeSessionId: string,
) {
  return supabase
    .from("orders")
    .select("*, order_items(*, products(title, mockup_url))")
    .eq("stripe_session_id", stripeSessionId)
    .single();
}

export async function getOrderByPrintfulId(
  supabase: SupabaseClient,
  printfulOrderId: string,
) {
  return supabase
    .from("orders")
    .select("*")
    .eq("printful_order_id", printfulOrderId)
    .single();
}

export async function markOrderPaid(
  supabase: SupabaseClient,
  stripeSessionId: string,
  data: {
    stripe_payment_id?: string | null;
    shipping_name?: string | null;
    shipping_address?: Record<string, string> | null;
    buyer_email?: string | null;
  },
) {
  const update: Record<string, unknown> = { status: "processing" };
  if (data.stripe_payment_id) update.stripe_payment_id = data.stripe_payment_id;
  if (data.shipping_name !== undefined) update.shipping_name = data.shipping_name;
  if (data.shipping_address !== undefined) update.shipping_address = data.shipping_address;
  if (data.buyer_email) update.buyer_email = data.buyer_email;
  return supabase
    .from("orders")
    .update(update)
    .eq("stripe_session_id", stripeSessionId)
    .select()
    .single();
}

export async function updateOrderPrintfulId(
  supabase: SupabaseClient,
  stripeSessionId: string,
  printfulOrderId: string,
) {
  return supabase
    .from("orders")
    .update({ printful_order_id: printfulOrderId })
    .eq("stripe_session_id", stripeSessionId);
}

export async function updateOrderTracking(
  supabase: SupabaseClient,
  printfulOrderId: string,
  trackingNumber: string,
  status: "shipped" | "delivered",
) {
  return supabase
    .from("orders")
    .update({ tracking_number: trackingNumber, status })
    .eq("printful_order_id", printfulOrderId);
}

export async function getOrdersByCreator(supabase: SupabaseClient, profileId: string) {
  // Pulls orders that have at least one line item belonging to this profile.
  return supabase
    .from("order_items")
    .select(
      "id, quantity, unit_price_cents, creator_earnings_cents, orders(*), products(title, mockup_url)",
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false, foreignTable: "orders" })
    .limit(50);
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
    consent_method?: ParentRow["consent_method"];
    consent_verified_at?: string | null;
  },
) {
  return supabase
    .from("parents")
    .upsert(data, { onConflict: "auth_user_id" })
    .select()
    .single();
}

export async function getParentByAuthUserId(
  supabase: SupabaseClient,
  authUserId: string,
) {
  return supabase
    .from("parents")
    .select("*")
    .eq("auth_user_id", authUserId)
    .single();
}

export async function setParentConsent(
  supabase: SupabaseClient,
  authUserId: string,
  method: NonNullable<ParentRow["consent_method"]>,
) {
  return supabase
    .from("parents")
    .update({
      consent_method: method,
      consent_verified_at: new Date().toISOString(),
    })
    .eq("auth_user_id", authUserId);
}

export async function updateParentStripe(
  supabase: SupabaseClient,
  authUserId: string,
  stripeConnectId: string,
  onboardingComplete: boolean,
) {
  return supabase
    .from("parents")
    .update({
      stripe_connect_id: stripeConnectId,
      stripe_onboarding_complete: onboardingComplete,
    })
    .eq("auth_user_id", authUserId);
}

export async function updateParentDisplayName(
  supabase: SupabaseClient,
  authUserId: string,
  displayName: string,
) {
  return supabase
    .from("parents")
    .update({ display_name: displayName })
    .eq("auth_user_id", authUserId)
    .select()
    .single();
}

// ── Profiles ──

export interface ProfileRow {
  id: string;
  parent_id: string;
  display_name: string;
  slug: string;
  avatar_url: string | null;
  catchphrase: string | null;
  bio: string;
  level: number;
  xp: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  storefront_hero_image_url?: string | null;
  storefront_headline?: string | null;
  storefront_subhead?: string | null;
  storefront_hero_overlay?: string | null;
  store_seo_title?: string | null;
  store_seo_description?: string | null;
  store_tags?: string[] | null;
  /**
   * Optional override of `avatar_url` for the public `/shop/[slug]` page
   * ONLY. Resolved by `getStorefrontAvatar`; everywhere else the personal
   * `avatar_url` is used.
   */
  storefront_avatar_url?: string | null;
  /**
   * Optional wide background image rendered behind the top section of the
   * public `/shop/[slug]` page. NULL means use the default header.
   */
  storefront_banner_url?: string | null;
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

export type ProfileStorefrontUpdate = Partial<
  Pick<
    ProfileRow,
    | "slug"
    | "bio"
    | "catchphrase"
    | "avatar_url"
    | "storefront_avatar_url"
    | "storefront_banner_url"
    | "display_name"
    | "storefront_hero_image_url"
    | "storefront_headline"
    | "storefront_subhead"
    | "storefront_hero_overlay"
    | "store_seo_title"
    | "store_seo_description"
    | "store_tags"
  >
>;

export async function updateProfileById(
  supabase: SupabaseClient,
  profileId: string,
  patch: ProfileStorefrontUpdate,
) {
  return supabase.from("profiles").update(patch).eq("id", profileId).select().single();
}

/** Returns true if another active profile already uses this slug. */
export async function isProfileSlugTaken(
  supabase: SupabaseClient,
  slug: string,
  excludeProfileId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("slug", slug)
    .neq("id", excludeProfileId)
    .maybeSingle();

  if (error) return true;
  return Boolean(data);
}

// ── Storefronts ─────────────────────────────────────────────────────────
//
// A profile (the creator user) can own multiple `storefronts`. Each
// storefront has its own slug, banner, avatar, and product list, but
// shares XP / Stripe Connect with the owner profile.

export interface StorefrontRow {
  id: string;
  owner_profile_id: string;
  slug: string;
  display_name: string;
  catchphrase: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  hero_image_url: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export async function listStorefrontsByOwner(
  supabase: SupabaseClient,
  ownerProfileId: string,
): Promise<StorefrontRow[]> {
  const { data, error } = await supabase
    .from("storefronts")
    .select("*")
    .eq("owner_profile_id", ownerProfileId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as StorefrontRow[];
}

/**
 * Look up a storefront by its public slug. Storefronts are world-readable
 * (RLS policy `storefronts_public_read`) so any caller — signed-in or not
 * — gets a row when one exists.
 */
export async function getStorefrontBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<StorefrontRow | null> {
  const { data, error } = await supabase
    .from("storefronts")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as StorefrontRow;
}

export async function getStorefrontById(
  supabase: SupabaseClient,
  storefrontId: string,
): Promise<StorefrontRow | null> {
  const { data, error } = await supabase
    .from("storefronts")
    .select("*")
    .eq("id", storefrontId)
    .maybeSingle();
  if (error || !data) return null;
  return data as StorefrontRow;
}

/** Returns true when another storefront row already owns this slug. */
export async function isStorefrontSlugTaken(
  supabase: SupabaseClient,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  let q = supabase.from("storefronts").select("id").eq("slug", slug);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q.maybeSingle();
  if (error) return true;
  return Boolean(data);
}

export async function countProductsByStorefront(
  supabase: SupabaseClient,
  storefrontId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("storefront_id", storefrontId);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Published products for a storefront — what `/shop/[slug]` renders.
 * Includes any legacy rows still attached only via `profile_id` (no
 * `storefront_id`) when this is the owner's default storefront, so we
 * don't lose old listings while the backfill catches up.
 */
export async function getPublishedProductsByStorefront(
  supabase: SupabaseClient,
  storefrontId: string,
  ownerProfileId: string,
  isDefault: boolean,
): Promise<Product[]> {
  const { data: linked, error: linkedErr } = await supabase
    .from("products")
    .select(PRODUCT_LISTING_SELECT)
    .eq("storefront_id", storefrontId)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (linkedErr) {
    console.error("[getPublishedProductsByStorefront]", storefrontId, linkedErr);
  }

  const rows: ProductRowWithProfile[] =
    (linked ?? []) as unknown as ProductRowWithProfile[];

  if (isDefault) {
    const { data: legacy } = await supabase
      .from("products")
      .select(PRODUCT_LISTING_SELECT)
      .eq("profile_id", ownerProfileId)
      .is("storefront_id", null)
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (legacy) {
      const seen = new Set(rows.map((r) => r.id));
      for (const row of legacy as unknown as ProductRowWithProfile[]) {
        if (!seen.has(row.id)) rows.push(row);
      }
    }
  }

  rows.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return rows.map(mapProductRow);
}

// ── DMCA ──

export async function insertDmcaReport(
  supabase: SupabaseClient,
  data: {
    design_id: string | null;
    reporter_email: string;
    reporter_name: string;
    description: string;
  },
) {
  return supabase.from("dmca_reports").insert(data).select().single();
}
