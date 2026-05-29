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
): boolean {
  const m = mockupUrl?.trim();
  if (!m) return false;
  if (m.startsWith("data:")) return false;
  const d = designImageUrl?.trim();
  if (d && m === d) return false;
  return true;
}

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  hoodie: "Hoodie",
  "kids-hoodie": "Kids hoodie",
  "kids-tshirt": "Kids tee",
  "kids-heavyweight-tee": "Kids heavyweight tee",
  "kids-long-sleeve": "Kids long sleeve",
  "kids-sports-tee": "Kids sports tee",
  tshirt: "Tee",
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
