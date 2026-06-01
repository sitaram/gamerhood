/** Lightweight storefront shape for nav, context bar, and dropdowns. */
export type CreatorStorefrontNav = {
  id: string;
  slug: string;
  displayName: string;
  isDefault: boolean;
};

export function slugFromShopPathname(pathname: string): string | null {
  const match = pathname.match(/^\/shop\/([^/]+)/);
  return match?.[1] ?? null;
}

export function isViewingShop(pathname: string, slug: string): boolean {
  return pathname === `/shop/${slug}` || pathname.startsWith(`/shop/${slug}/`);
}

/** True when the user is on seller dashboard tools or one of their public shops. */
export function isUnderCreatorStorefrontArea(
  pathname: string,
  storefronts: CreatorStorefrontNav[],
): boolean {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return true;
  }
  const slug = slugFromShopPathname(pathname);
  if (!slug) return false;
  return storefronts.some((s) => s.slug === slug);
}

export function defaultStorefront(
  storefronts: CreatorStorefrontNav[],
): CreatorStorefrontNav | null {
  return storefronts.find((s) => s.isDefault) ?? storefronts[0] ?? null;
}

export function storefrontBySlug(
  storefronts: CreatorStorefrontNav[],
  slug: string,
): CreatorStorefrontNav | undefined {
  return storefronts.find((s) => s.slug === slug);
}

export const ACTIVE_STOREFRONT_STORAGE_KEY = "gamerhood:active-storefront-id";

export function readActiveStorefrontId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_STOREFRONT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeActiveStorefrontId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_STOREFRONT_STORAGE_KEY, id);
  } catch {
    // Private browsing / quota — ignore.
  }
}
