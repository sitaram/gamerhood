/**
 * Printful color-name → hex lookup.
 *
 * Source of truth at publish time is `printfulCatalogMeta.catalogColors`
 * (see `src/lib/printful/catalog-meta.ts`), persisted on the product row.
 * That field carries the exact `{ name, hex }` Printful returned for the
 * SKU when the listing was published.
 *
 * This static map is a *fallback* for:
 *   - products published before catalog-meta was persisted
 *   - catalog rows where `hex` is null (Printful sometimes omits it for
 *     heathered/marled SKUs)
 *   - color names not surfaced via catalog (rare, but happens with
 *     manually-edited `products.colors`)
 *
 * Names are normalized via `normalizeColorName` (case-insensitive,
 * collapsed whitespace, stripped punctuation) so storefront-defined names
 * like "Navy Blazer" line up with catalog-defined "Navy blazer".
 *
 * Heather/marled colors get a `hex2`; the chip renders as a 135° split.
 */

import type { PrintfulCatalogMeta } from "@/lib/types";

export interface ColorSwatch {
  hex: string | null;
  hex2?: string | null;
}

const NEUTRAL_FALLBACK: ColorSwatch = { hex: "#9ca3af" };

/**
 * Pulled from Printful catalog (Bella+Canvas 3001 / 3001Y, Gildan 18500 /
 * 8000B, Cotton Heritage M7580 / Y2550, Lane Seven LS16001, Comfort Colors
 * 9018, Econscious EC8000, …). When a SKU has a heather/marled colorway
 * the two warp/weft yarns are captured as `hex` + `hex2`.
 *
 * Keys are normalized (lowercased, single-spaced, alphanum + spaces). To
 * add: copy the name straight from Printful's catalog UI; the normalizer
 * handles "Heather Grey" vs "Heather grey" etc.
 */
const STATIC_HEX_BY_NAME: Record<string, ColorSwatch> = {
  // Whites + creams
  white: { hex: "#ffffff" },
  "vintage white": { hex: "#f6efe4" },
  ivory: { hex: "#f2ead3" },
  natural: { hex: "#e6dbc1" },
  cream: { hex: "#f0e6d2" },
  bone: { hex: "#e8e0d0" },
  sand: { hex: "#d8c9a8" },

  // Greys
  ash: { hex: "#c8c8c8" },
  silver: { hex: "#c0c2c2" },
  "heather grey": { hex: "#b7b7b8", hex2: "#a0a1a3" },
  "heather gray": { hex: "#b7b7b8", hex2: "#a0a1a3" },
  "athletic heather": { hex: "#cdd0d2", hex2: "#9aa0a4" },
  "deep heather": { hex: "#7a7d80", hex2: "#5f6265" },
  "dark heather": { hex: "#3f4244", hex2: "#5a5d5f" },
  "heather dust": { hex: "#d2c8b6", hex2: "#b3a98e" },
  "heather mauve": { hex: "#a47884", hex2: "#7e5b66" },
  "heather forest": { hex: "#3a5a44", hex2: "#23402d" },
  "heather navy": { hex: "#2b3653", hex2: "#171f31" },
  "heather red": { hex: "#a4262c", hex2: "#7c1b1f" },
  "heather columbia blue": { hex: "#8aa8c4", hex2: "#6789a8" },
  "heather true royal": { hex: "#3e5fa9", hex2: "#283f7d" },
  graphite: { hex: "#4a4a4a" },
  charcoal: { hex: "#36383a" },
  smoke: { hex: "#7c7d7f" },
  pewter: { hex: "#7b7e80" },
  "sport grey": { hex: "#9b9b9b", hex2: "#878787" },
  "sport gray": { hex: "#9b9b9b", hex2: "#878787" },
  asphalt: { hex: "#3c3c3c" },

  // Blacks
  black: { hex: "#111111" },
  "vintage black": { hex: "#222222" },
  jet: { hex: "#0c0c0c" },

  // Blues
  navy: { hex: "#1f2a44" },
  "navy blazer": { hex: "#1c2640" },
  "true navy": { hex: "#1d2745" },
  "deep navy": { hex: "#0f1830" },
  "midnight navy": { hex: "#172238" },
  "midnight blue": { hex: "#1d2c4a" },
  "true royal": { hex: "#1f3fa1" },
  royal: { hex: "#1f3fa1" },
  "carolina blue": { hex: "#76a4d8" },
  "columbia blue": { hex: "#a8c7d9" },
  "baby blue": { hex: "#bcdaee" },
  "light blue": { hex: "#bcdaee" },
  "ocean blue": { hex: "#1e6091" },
  "lake blue": { hex: "#2b6e9a" },
  aqua: { hex: "#3dbfd1" },
  turquoise: { hex: "#1ea7ad" },
  teal: { hex: "#147a85" },
  steel: { hex: "#5a7794" },
  denim: { hex: "#3b556d" },
  "true blue": { hex: "#1f55a8" },
  indigo: { hex: "#2c3a85" },

  // Greens
  army: { hex: "#5c5b3f" },
  olive: { hex: "#7a7240" },
  "military green": { hex: "#5f6034" },
  forest: { hex: "#22432a" },
  kelly: { hex: "#2f8c4a" },
  "irish green": { hex: "#2a9d52" },
  green: { hex: "#3a8c4f" },
  mint: { hex: "#bfe2c5" },
  "soft mint": { hex: "#bfe2c5" },
  sage: { hex: "#a7b89a" },

  // Reds / pinks
  red: { hex: "#b3252b" },
  cardinal: { hex: "#9c1c2c" },
  cherry: { hex: "#a31b2d" },
  maroon: { hex: "#6b1f2a" },
  burgundy: { hex: "#5e1c28" },
  brick: { hex: "#8d2b27" },
  "true red": { hex: "#c32230" },
  pink: { hex: "#e8a3ba" },
  "soft pink": { hex: "#f4cad3" },
  "light pink": { hex: "#f5d4dc" },
  "hot pink": { hex: "#d6377f" },
  fuchsia: { hex: "#c4378a" },
  berry: { hex: "#9b2855" },
  raspberry: { hex: "#a8324d" },
  mauve: { hex: "#a47880" },
  rose: { hex: "#c46e7d" },
  coral: { hex: "#e26a5b" },

  // Oranges / yellows / browns
  orange: { hex: "#e07f30" },
  "burnt orange": { hex: "#a8501f" },
  autumn: { hex: "#a44f25" },
  rust: { hex: "#9a3f22" },
  gold: { hex: "#d6a83b" },
  "yam gold": { hex: "#d6a23b" },
  mustard: { hex: "#c69a26" },
  yellow: { hex: "#f3d34a" },
  "daisy yellow": { hex: "#f1cf3b" },
  "pale yellow": { hex: "#f4e8a8" },
  brown: { hex: "#5b3a25" },
  chocolate: { hex: "#3e2922" },
  espresso: { hex: "#2e211a" },
  khaki: { hex: "#b8a378" },
  tan: { hex: "#b89870" },

  // Purples
  purple: { hex: "#5b3690" },
  "team purple": { hex: "#4a2d7a" },
  "deep purple": { hex: "#3d2466" },
  lilac: { hex: "#c9b0d9" },
  lavender: { hex: "#bbacd6" },
  violet: { hex: "#7a4cc2" },
  plum: { hex: "#522948" },
};

function normalizeColorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidHex(s: string | null | undefined): s is string {
  if (!s) return false;
  return /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s.trim());
}

function withHash(s: string): string {
  const t = s.trim();
  return t.startsWith("#") ? t : `#${t}`;
}

/**
 * Resolve a swatch for a Printful color name.
 *
 * Order of preference:
 *   1. `catalogColors` snapshot from the product's persisted Printful meta
 *      (the exact hex Printful served at publish time).
 *   2. The static map above (covers everything Printful currently ships
 *      across our active blueprints).
 *   3. `null` hex — caller renders a neutral grey dot with no crash.
 *
 * Heathers: if the static map has `hex2` we surface it. Catalog meta only
 * carries one hex per color today; heather treatment falls through to the
 * static entry when present.
 */
export function resolveColorSwatch(
  colorName: string,
  catalogColors?: PrintfulCatalogMeta["catalogColors"] | null,
): ColorSwatch {
  const norm = normalizeColorName(colorName);
  if (!norm) return NEUTRAL_FALLBACK;

  const fromCatalog = catalogColors?.find(
    (c) => normalizeColorName(c.name) === norm,
  );
  const staticEntry = STATIC_HEX_BY_NAME[norm];

  const primaryHex =
    fromCatalog && isValidHex(fromCatalog.hex)
      ? withHash(fromCatalog.hex as string)
      : staticEntry?.hex ?? null;

  return {
    hex: primaryHex,
    hex2: staticEntry?.hex2 ?? null,
  };
}

/** Crude perceived-luminance test so the chip can opt-in to a faint border. */
export function isLightColor(hex: string | null): boolean {
  if (!hex) return false;
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (full.length !== 6) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  /** Rec 709 luma; threshold tuned so "Baby Blue" / "Ivory" trip the border but "Sport Grey" does not. */
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.82;
}
