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
  storefrontIdsByProductId: Map<string, string[]> = new Map(),
): ManagedListingRow[] {
  const defaultStorefront =
    storefronts.find((s) => s.is_default) ?? storefronts[0] ?? null;

  return products.map((p) => {
    const linkedIds = storefrontIdsByProductId.get(p.id) ?? [];
    const fallbackId = p.storefront_id ?? defaultStorefront?.id ?? null;
    const resolvedStorefrontIds = linkedIds.length
      ? linkedIds
      : fallbackId
        ? [fallbackId]
        : [];
    const resolvedStorefronts = resolvedStorefrontIds
      .map((id) => storefronts.find((s) => s.id === id) ?? null)
      .filter((s): s is StorefrontRow => Boolean(s));
    return {
      id: p.id,
      designId: p.design_id,
      title: p.title,
      productType: p.product_type as ProductType,
      mockupUrl: p.mockup_url ?? null,
      designImageUrl: p.designs?.image_url ?? null,
      designUploadedAsSvg: p.designs?.uploaded_as_svg ?? undefined,
      designHasTransparency:
        typeof p.designs?.has_transparency === "boolean"
          ? p.designs.has_transparency
          : null,
      priceCents: p.base_price_cents + p.markup_cents,
      isPublished: p.is_published,
      salesCount: p.sales_count ?? 0,
      createdAt: p.created_at,
      storefrontIds: resolvedStorefrontIds,
      storefrontSlugs: resolvedStorefronts.map((s) => s.slug),
      storefrontDisplayNames: resolvedStorefronts.map((s) => s.display_name),
      printPlacement: parseStoredPlacement(p.print_placement),
    };
  });
}
