/**
 * Pure helpers shared by `<ProductCard>` (client) and a handful of server
 * components that need to label product types or decide whether a saved
 * mockup is renderable.
 *
 * These used to live in `product-card.tsx`, but that file is marked
 * `"use client"` — and Next 16 / RSC treats every named export of a
 * client module as a client reference, so trying to *call*
 * `hasRenderableListingMockup` (or read a key off `PRODUCT_TYPE_LABELS`)
 * from a server component throws:
 *
 *   Attempted to call hasRenderableListingMockup() from the server but
 *   hasRenderableListingMockup is on the client.
 *
 * Splitting them into this no-directive module lets the server import
 * them as plain values while the client `<ProductCard>` keeps using the
 * same source of truth.
 */

/**
 * `mockup_url` is "renderable as the listing photo" when the publish flow (or
 * a creator's custom upload) actually wrote a real image — i.e. it's not
 * empty, not a `data:` blob, and not the fallback where the publish route
 * stamped the bare design URL because Printful mockup-tasks failed/was unset.
 *
 * When this returns true we render `<Image src={mockup_url}>` directly: that's
 * either a Printful-CDN photo of the design composited on the actual garment,
 * or a creator-uploaded custom listing photo from Supabase Storage. Otherwise
 * we fall back to the in-browser `MerchPlacementPreview` (design composited
 * on the blank Printful flat photo + dashed print-area markers).
 */
export function hasRenderableListingMockup(
  mockupUrl: string | null | undefined,
  designImageUrl: string | null | undefined,
  opts?: { designUploadedAsSvg?: boolean; designHasTransparency?: boolean | null },
): boolean {
  const m = mockupUrl?.trim();
  if (!m) return false;
  if (m.startsWith("data:")) return false;
  if (!/^https?:\/\//i.test(m)) return false;
  // Raw printful.com URLs are temporary (CDN expiry) — only our re-hosted
  // copies are safe to display. Legacy rows with a printful.com mockup fall
  // back to live composition until they're re-published / refreshed.
  if (/printful\.com/i.test(m)) return false;
  // SVG-origin artwork can carry an opaque vector background that Printful
  // bakes into the render; keep live sanitized composition for those.
  if (opts?.designUploadedAsSvg) return false;
  // A `mockup_url` equal to the design itself isn't a real product mockup.
  const d = designImageUrl?.trim();
  if (d && m === d) return false;
  // A re-hosted Printful mockup IS what gets printed — prefer it everywhere.
  // (No transparency gate: the real render is the truthful representation of
  // the print, whether the art is transparent or a solid rectangle.)
  return true;
}

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  hoodie: "Adult hoodie",
  "kids-hoodie": "Kids hoodie",
  "kids-tshirt": "Kids tee",
  "kids-heavyweight-tee": "Kids heavyweight tee",
  "kids-long-sleeve": "Kids long sleeve",
  "kids-sports-tee": "Kids sports tee",
  tshirt: "Adult tee",
  joggers: "Joggers",
  mug: "Mug",
  poster: "Poster",
  backpack: "Backpack",
  "phone-case": "Phone Case",
  sticker: "Sticker",
  pillow: "Shaped pillow",
  blanket: "Sherpa blanket",
  "pet-sweater": "Pet sweater",
  "tote-bag": "Eco tote",
  ornament: "Metal ornament",
  puzzle: "Jigsaw puzzle",
  "embroidered-patch": "Embroidered patch",
  "hardcover-journal": "Hardcover journal",
};

function titleCaseWords(input: string): string {
  return input
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Defensive label formatter for storefront badges.
 * Some legacy rows can contain non-canonical product type strings
 * (spacing/casing/synonyms), so we normalize first and still force
 * an explicit kids/adult modifier for apparel.
 */
export function formatProductTypeLabel(productType: string): string {
  const normalized = productType
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-");

  const known = PRODUCT_TYPE_LABELS[normalized];
  if (known) return known;

  const isKids = /\b(kids?|youth)\b/.test(normalized);
  const isHoodie = normalized.includes("hoodie");
  const isTee =
    normalized.includes("tshirt") ||
    normalized.includes("t-shirt") ||
    normalized.includes("tee");

  if (isHoodie) return isKids ? "Kids hoodie" : "Adult hoodie";
  if (isTee) return isKids ? "Kids tee" : "Adult tee";

  return titleCaseWords(normalized.replace(/-/g, " "));
}
