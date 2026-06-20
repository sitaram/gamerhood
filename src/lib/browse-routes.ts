import type { ProductType } from "@/lib/types";
import { blockedSlugLanguageReason } from "@/lib/slug-content-policy";

const CATEGORY_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * First URL segment cannot be a browse category if it would shadow real app routes.
 * Keep in sync with `src/app` top-level folders + common static paths.
 */
export const RESERVED_BROWSE_FIRST_SEGMENTS = new Set([
  "_next",
  "about",
  "api",
  "apple-icon",
  "auth",
  "cart",
  "checkout",
  "create",
  "dashboard",
  "dmca",
  "faq",
  "icon",
  "login",
  "opengraph-image",
  "privacy",
  "product",
  "robots.txt",
  "safety",
  "shop",
  "signup",
  "terms",
  "twitter-image",
]);

/** URL segment (second path part) → internal `products.product_type`. */
const MERCH_SEGMENT_TO_TYPE: Record<string, ProductType> = {
  hoodie: "hoodie",
  hoodies: "hoodie",
  "kids-hoodie": "kids-hoodie",
  "kids-hoodies": "kids-hoodie",
  "kids-heavyweight-tee": "kids-heavyweight-tee",
  "kids-heavyweight-tees": "kids-heavyweight-tee",
  "youth-heavyweight-tee": "kids-heavyweight-tee",
  "youth-heavyweight-tees": "kids-heavyweight-tee",
  "kids-long-sleeve": "kids-long-sleeve",
  "kids-long-sleeves": "kids-long-sleeve",
  "youth-long-sleeve": "kids-long-sleeve",
  "youth-long-sleeves": "kids-long-sleeve",
  "kids-tshirt": "kids-tshirt",
  "kids-tees": "kids-tshirt",
  "kids-tshirts": "kids-tshirt",
  "kids-sports-tee": "kids-sports-tee",
  "kids-sports-tees": "kids-sports-tee",
  tshirt: "tshirt",
  tee: "tshirt",
  tees: "tshirt",
  "t-shirts": "tshirt",
  joggers: "joggers",
  jogger: "joggers",
  mug: "mug",
  mugs: "mug",
  poster: "poster",
  posters: "poster",
  sticker: "sticker",
  stickers: "sticker",
  pillow: "pillow",
  pillows: "pillow",
  blanket: "blanket",
  blankets: "blanket",
  "pet-sweater": "pet-sweater",
  "pet-sweaters": "pet-sweater",
  backpack: "backpack",
  backpacks: "backpack",
  "phone-case": "phone-case",
  "phone-cases": "phone-case",
  tote: "tote-bag",
  totes: "tote-bag",
  "tote-bag": "tote-bag",
  "tote-bags": "tote-bag",
  ornament: "ornament",
  ornaments: "ornament",
  puzzle: "puzzle",
  puzzles: "puzzle",
  jigsaw: "puzzle",
  patch: "embroidered-patch",
  patches: "embroidered-patch",
  "embroidered-patch": "embroidered-patch",
  "embroidered-patches": "embroidered-patch",
  journal: "hardcover-journal",
  journals: "hardcover-journal",
  notebook: "hardcover-journal",
  notebooks: "hardcover-journal",
  "hardcover-journal": "hardcover-journal",
  "hardcover-journals": "hardcover-journal",
};

/** Pretty path segment for each type (used in `/category/hoodies` style URLs). */
export const PRODUCT_TYPE_TO_BROWSE_SEGMENT: Record<ProductType, string> = {
  hoodie: "hoodies",
  "kids-hoodie": "kids-hoodies",
  "kids-heavyweight-tee": "kids-heavyweight-tees",
  "kids-long-sleeve": "kids-long-sleeves",
  "kids-tshirt": "kids-tees",
  "kids-sports-tee": "kids-sports-tees",
  tshirt: "tees",
  joggers: "joggers",
  mug: "mugs",
  poster: "posters",
  backpack: "backpacks",
  "phone-case": "phone-cases",
  sticker: "stickers",
  pillow: "pillows",
  blanket: "blankets",
  "pet-sweater": "pet-sweaters",
  "tote-bag": "totes",
  ornament: "ornaments",
  puzzle: "puzzles",
  "embroidered-patch": "patches",
  "hardcover-journal": "journals",
};

export function normalizeBrowseCategorySegment(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function validateBrowseCategorySlug(raw: string): { ok: true; slug: string } | { ok: false; error: string } {
  const slug = normalizeBrowseCategorySegment(raw);
  if (slug.length < 2) return { ok: false, error: "Category URL must be at least 2 characters." };
  if (slug.length > 48) return { ok: false, error: "Category URL must be at most 48 characters." };
  if (!CATEGORY_SLUG_RE.test(slug)) {
    return { ok: false, error: "Use lowercase letters, numbers, and single hyphens only." };
  }
  if (RESERVED_BROWSE_FIRST_SEGMENTS.has(slug)) {
    return { ok: false, error: "That URL path is reserved for the site. Pick another slug." };
  }
  const blocked = blockedSlugLanguageReason(slug);
  if (blocked) return { ok: false, error: blocked };
  return { ok: true, slug };
}

/** All merch for a tag — `/{tag}/merch` (any product type). */
export const BROWSE_MERCH_HUB_SEGMENT = "merch";

export function isBrowseMerchHubSegment(segment: string): boolean {
  return segment.trim().toLowerCase() === BROWSE_MERCH_HUB_SEGMENT;
}

export function merchSegmentToProductType(segment: string): ProductType | null {
  const key = segment.trim().toLowerCase();
  if (isBrowseMerchHubSegment(key)) return null;
  return MERCH_SEGMENT_TO_TYPE[key] ?? null;
}

/**
 * Build a global browse URL: `/{categorySlug}/{merchSegment}` e.g. `/fortnite-inspired/hoodies`.
 */
export function buildBrowsePath(categorySlug: string, productType: ProductType): string {
  const cat = normalizeBrowseCategorySegment(categorySlug);
  const merch = PRODUCT_TYPE_TO_BROWSE_SEGMENT[productType];
  return `/${cat}/${merch}`;
}

export function formatBrowseHeading(categorySlug: string, productType: ProductType): string {
  const human = categorySlug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const seg = PRODUCT_TYPE_TO_BROWSE_SEGMENT[productType] ?? productType;
  const merchHuman = seg
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `${human} · ${merchHuman}`;
}
