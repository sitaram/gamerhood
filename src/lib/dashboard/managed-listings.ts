import type {
  ManagedListingRow,
  ManagedStorefrontOption,
} from "@/components/dashboard/listings-manager";
import type { CreatorStorefrontNav } from "@/lib/dashboard/storefront-nav";
import { parseStoredPlacement } from "@/lib/print/placement";
import type { ProductRow, StorefrontRow } from "@/lib/supabase/queries";
import type { ProductType } from "@/lib/types";

export function toManagedStorefrontOptions(
  storefronts: StorefrontRow[],
): ManagedStorefrontOption[] {
  return storefronts.map((s) => ({
    id: s.id,
    slug: s.slug,
    displayName: s.display_name,
    isDefault: s.is_default,
  }));
}

export function toCreatorStorefrontNav(
  storefronts: StorefrontRow[],
): CreatorStorefrontNav[] {
  return storefronts.map((s) => ({
    id: s.id,
    slug: s.slug,
    displayName: s.display_name,
    isDefault: s.is_default,
  }));
}

export function toManagedListings(
  products: ProductRow[],
  storefronts: StorefrontRow[],
): ManagedListingRow[] {
  const defaultStorefront =
    storefronts.find((s) => s.is_default) ?? storefronts[0] ?? null;

  return products.map((p) => {
    // Legacy products (pre multi-storefront) have a null storefront_id.
    // Treat them as living on the owner's default storefront so the badge
    // and filter still resolve to a meaningful shop.
    const resolvedStorefrontId = p.storefront_id ?? defaultStorefront?.id ?? null;
    const storefront = storefronts.find((s) => s.id === resolvedStorefrontId) ?? null;
    return {
      id: p.id,
      title: p.title,
      productType: p.product_type as ProductType,
      mockupUrl: p.mockup_url ?? null,
      designImageUrl: p.designs?.image_url ?? null,
      priceCents: p.base_price_cents + p.markup_cents,
      isPublished: p.is_published,
      salesCount: p.sales_count ?? 0,
      createdAt: p.created_at,
      storefrontId: resolvedStorefrontId,
      storefrontSlug: storefront?.slug ?? null,
      storefrontDisplayName: storefront?.display_name ?? null,
      printPlacement: parseStoredPlacement(p.print_placement),
    };
  });
}
