import { getServiceClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Defaults pre-filled into the /create publish form for the chosen
 * storefront. Source tells the UI which copy to show next to the
 * fields ("Pre-filled from your store defaults" vs. "from your last
 * listing") so sellers know where the text came from.
 */
export type ListingDefaults = {
  description: string;
  tags: string[];
  categorySlug: string;
  /** Whole percent (0–100) for /create pricing slider seed. */
  defaultMarkupPercent: number;
  source: "storefront-defaults" | "last-listing" | "none";
};


function readDefaultMarkupPercent(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 10;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

const EMPTY: ListingDefaults = {
  description: "",
  tags: [],
  categorySlug: "",
  defaultMarkupPercent: 10,
  source: "none",
};

/**
 * Resolve the values that pre-fill the publish form. Fallback chain:
 *
 *   1. Explicit per-storefront defaults (set in /dashboard/settings).
 *      Any single one of {description, tags, category_slug} being set
 *      is enough to short-circuit — we don't dilute with last-listing
 *      data because the seller has signaled intent on this storefront.
 *   2. The most recent published product on the same storefront. Read
 *      with the service client so legacy rows attached only via
 *      `profile_id` (storefront_id NULL — backfilled lazily in the 029
 *      migration) still surface and we don't return blank for sellers
 *      whose first multi-storefront publish predates the link.
 *   3. Nothing — first-time seller. The fields stay blank.
 *
 * Soft-fails to EMPTY on any read error: a transient supabase blip
 * shouldn't break the publish form. The caller treats source="none"
 * as "show no badge, don't pre-fill" so an error path is visually
 * indistinguishable from a brand-new seller.
 */
export async function getListingDefaultsForStorefront(
  supabase: SupabaseClient,
  storefrontId: string,
): Promise<ListingDefaults> {
  if (!storefrontId) return EMPTY;

  let admin: SupabaseClient;
  try {
    admin = getServiceClient();
  } catch {
    // Service role isn't configured (local dev sans env). Fall back to
    // the caller's client — RLS will still let the owner read their
    // own storefront + products.
    admin = supabase;
  }

  const { data: storefront, error: sfErr } = await admin
    .from("storefronts")
    .select(
      "id, owner_profile_id, is_default, default_description, default_tags, default_category_slug, default_markup_percent",
    )
    .eq("id", storefrontId)
    .maybeSingle();

  if (sfErr || !storefront) return EMPTY;

  const defaultMarkupPercent = readDefaultMarkupPercent(
    (storefront as { default_markup_percent?: unknown }).default_markup_percent,
  );

  const explicitDescription =
    typeof storefront.default_description === "string"
      ? storefront.default_description.trim()
      : "";
  const explicitTags = Array.isArray(storefront.default_tags)
    ? (storefront.default_tags as unknown[]).filter(
        (t): t is string => typeof t === "string" && t.length > 0,
      )
    : [];
  const explicitCategory =
    typeof storefront.default_category_slug === "string"
      ? storefront.default_category_slug.trim()
      : "";

  if (explicitDescription || explicitTags.length > 0 || explicitCategory) {
    return {
      description: explicitDescription,
      tags: explicitTags,
      categorySlug: explicitCategory,
      defaultMarkupPercent,
      source: "storefront-defaults",
    };
  }

  // Most recent published listing on this storefront. Prefer the
  // multi-storefront join table, then fall back to legacy storefront_id
  // rows while older data migrates.
  const ownerProfileId = storefront.owner_profile_id as string | null;
  const isDefault = Boolean(storefront.is_default);

  let candidate: {
    description?: string | null;
    tags?: unknown;
    category?: string | null;
    created_at?: string;
  } | null = null;

  const { data: links } = await admin
    .from("product_storefronts")
    .select("product_id")
    .eq("storefront_id", storefrontId);
  const linkedIds = Array.from(
    new Set(
      (links ?? [])
        .map((r) => (r as { product_id?: string }).product_id ?? "")
        .filter((id) => id.length > 0),
    ),
  );
  if (linkedIds.length > 0) {
    const { data: linkedRows } = await admin
      .from("products")
      .select("description, tags, category, created_at")
      .in("id", linkedIds)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(1);
    candidate = (linkedRows ?? [])[0] ?? null;
  }

  if (!candidate) {
    const { data: legacyLinked } = await admin
      .from("products")
      .select("description, tags, category, created_at")
      .eq("storefront_id", storefrontId)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(1);
    candidate = (legacyLinked ?? [])[0] ?? null;
  }

  if (!candidate && isDefault && ownerProfileId) {
    const { data: legacy } = await admin
      .from("products")
      .select("description, tags, category, created_at")
      .eq("profile_id", ownerProfileId)
      .is("storefront_id", null)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(1);
    candidate = (legacy ?? [])[0] ?? null;
  }

  if (!candidate) return EMPTY;

  const description =
    typeof candidate.description === "string" ? candidate.description.trim() : "";
  const tags = Array.isArray(candidate.tags)
    ? (candidate.tags as unknown[]).filter(
        (t): t is string => typeof t === "string" && t.length > 0,
      )
    : [];
  const categorySlug =
    typeof candidate.category === "string" ? candidate.category.trim() : "";

  if (!description && tags.length === 0 && !categorySlug) return EMPTY;

  return {
    description,
    tags,
    categorySlug,
    defaultMarkupPercent,
    source: "last-listing",
  };
}
