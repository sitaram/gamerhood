import {
  BROWSE_MERCH_HUB_SEGMENT,
  PRODUCT_TYPE_TO_BROWSE_SEGMENT,
} from "@/lib/browse-routes";

/** Common browse paths admins seed for a tag (e.g. fortnite → hoodies + merch hub). */
export const BROWSE_TAG_PREVIEW_SEGMENTS: { segment: string; label: string }[] = [
  { segment: BROWSE_MERCH_HUB_SEGMENT, label: "All merch" },
  { segment: PRODUCT_TYPE_TO_BROWSE_SEGMENT.hoodie, label: "Hoodies" },
  { segment: PRODUCT_TYPE_TO_BROWSE_SEGMENT.tshirt, label: "Tees" },
  { segment: PRODUCT_TYPE_TO_BROWSE_SEGMENT.mug, label: "Mugs" },
  { segment: PRODUCT_TYPE_TO_BROWSE_SEGMENT.poster, label: "Posters" },
  { segment: PRODUCT_TYPE_TO_BROWSE_SEGMENT.sticker, label: "Stickers" },
];

export function browsePathsForTagSlug(slug: string): { segment: string; label: string; path: string }[] {
  const cat = slug.trim().toLowerCase();
  return BROWSE_TAG_PREVIEW_SEGMENTS.map(({ segment, label }) => ({
    segment,
    label,
    path: `/${cat}/${segment}`,
  }));
}

export function formatTagBrowseHubTitle(categorySlug: string, displayName?: string | null): string {
  if (displayName?.trim()) return `${displayName.trim()} merch`;
  const human = categorySlug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `${human} merch`;
}

export const PLATFORM_TAG_EXAMPLES = [
  { slug: "fortnite", name: "Fortnite" },
  { slug: "geometry-dash", name: "Geometry Dash" },
  { slug: "minecraft", name: "Minecraft" },
  { slug: "roblox", name: "Roblox" },
] as const;
