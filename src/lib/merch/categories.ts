import type { ProductType } from "@/lib/types";

/**
 * Top-level merch categories shown in the Create flow.
 *
 * Each category groups one or more Printful blanks (`ProductType`). When a category
 * only has one blank, the Create UI auto-toggles that blank (no checkbox shown).
 * Order here drives the order of category cards on `/create`.
 */
export interface MerchCategory {
  id: string;
  label: string;
  emoji: string;
  /** One-liner shown under the category label on the card. */
  blurb: string;
  variants: ProductType[];
}

export const MERCH_CATEGORIES: MerchCategory[] = [
  {
    id: "hoodies",
    label: "Hoodies",
    emoji: "🧥",
    blurb: "Pullover hoodies in adult and youth fits.",
    variants: ["hoodie", "kids-hoodie"],
  },
  {
    id: "tees",
    label: "Tees & long-sleeves",
    emoji: "👕",
    blurb: "Adult and youth tees, including heavyweight, long-sleeve, and sports cuts.",
    variants: [
      "tshirt",
      "kids-tshirt",
      "kids-heavyweight-tee",
      "kids-long-sleeve",
      "kids-sports-tee",
    ],
  },
  {
    id: "bottoms",
    label: "Bottoms",
    emoji: "🩳",
    blurb: "Sweatpants and joggers.",
    variants: ["joggers"],
  },
  {
    id: "drinkware",
    label: "Drinkware",
    emoji: "☕",
    blurb: "Ceramic and travel mugs.",
    variants: ["mug"],
  },
  {
    id: "home",
    label: "Home & living",
    emoji: "🛋️",
    blurb: "Pillows, blankets, posters, puzzles, journals, ornaments.",
    variants: ["pillow", "blanket", "poster", "puzzle", "ornament", "hardcover-journal"],
  },
  {
    id: "bags",
    label: "Bags",
    emoji: "🎒",
    blurb: "Tote bags and backpacks.",
    variants: ["tote-bag", "backpack"],
  },
  {
    id: "accessories",
    label: "Accessories",
    emoji: "🏷️",
    blurb: "Stickers, phone cases, embroidered patches.",
    variants: ["sticker", "phone-case", "embroidered-patch"],
  },
  {
    id: "pets",
    label: "Pets",
    emoji: "🐾",
    blurb: "Knit pet sweaters.",
    variants: ["pet-sweater"],
  },
];

const _CATEGORY_BY_TYPE: Map<ProductType, MerchCategory> = (() => {
  const m = new Map<ProductType, MerchCategory>();
  for (const cat of MERCH_CATEGORIES) {
    for (const t of cat.variants) m.set(t, cat);
  }
  return m;
})();

export function getCategoryForProductType(type: ProductType): MerchCategory | null {
  return _CATEGORY_BY_TYPE.get(type) ?? null;
}

/** Sentinel used when a category has exactly one variant — picker treats the card as a single checkbox. */
export function isSingleVariantCategory(cat: MerchCategory): boolean {
  return cat.variants.length === 1;
}
