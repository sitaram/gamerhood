import type { LucideIcon } from "lucide-react";
import { ExternalLink, Images, LayoutGrid, Store, Tags } from "lucide-react";

export type SellerNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Creator tools linked from navbar Storefront menu, dashboard subnav, and footer. */
export const SELLER_DASHBOARD_NAV: SellerNavItem[] = [
  { href: "/dashboard/designs", label: "My Images & Uploads", icon: Images },
  { href: "/dashboard/listings", label: "Manage listings", icon: LayoutGrid },
  { href: "/dashboard/storefront", label: "Storefront settings", icon: Store },
  { href: "/dashboard/categories", label: "SEO categories", icon: Tags },
];

export function sellerNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

/** Optional public shop link prepended when the creator has a slug. */
export function buildStorefrontNavItems(shopSlug: string | null): SellerNavItem[] {
  const items: SellerNavItem[] = [];
  if (shopSlug) {
    items.push({
      href: `/shop/${shopSlug}`,
      label: "View my shop (public view)",
      icon: ExternalLink,
    });
  }
  return [...items, ...SELLER_DASHBOARD_NAV];
}
