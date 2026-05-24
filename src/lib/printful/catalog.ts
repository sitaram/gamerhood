// Per-product-type Printful catalog configuration.
//
// Hoodie (adults): Lane Seven LS16001 — Unisex Urban Hoodie
// https://www.printful.com/custom/mens/hoodies/lane-seven-ls16001-urban-hoodie  (catalog product id ~1420)
// Set PRINTFUL_HOODIE_VARIANT_ID (e.g. Black/M → 34381).
//
// Kids hoodie (youth sizes): Cotton Heritage Y2550 — Kids Fleece Hoodie (catalog product id ~533)
// https://www.printful.com/custom/kids-teen/hoodies/kids-fleece-hoodie-cotton-heritage-y2550
// Set PRINTFUL_KIDS_HOODIE_VARIANT_ID (e.g. Black/M → 13388).
//
// Kids / youth tee: Bella + Canvas 3001Y — Youth Staple Tee (catalog product id ~307)
// https://www.printful.com/custom/kids-teen/all/youth-staple-tee-bella-canvas-3001y
// Set PRINTFUL_KIDS_TSHIRT_VARIANT_ID (e.g. Black/M → 9431).
//
// Youth long sleeve tee: Bella + Canvas 3501Y (catalog product id ~511).
// https://www.printful.com/custom/kids-teen/all/youth-long-sleeve-tee-bella-canvas-3501y
// DTG chest (`front`) typical — confirm placements if you switch SKU or offer embroidery-only variants.
// Set PRINTFUL_KIDS_LONG_SLEEVE_VARIANT_ID from `/v2/catalog-products/{id}/catalog-variants`.
//
// Youth garment-dyed heavyweight tee: Comfort Colors 9018 (catalog product id ~1485).
// https://www.printful.com/custom/kids-teen/all/youth-garment-dyed-heavyweight-t-shirt-comfort-colors-9018
// DTG chest (`front`) typical — confirm placements from `/v2/catalog-products/{id}` (garment-dyed cotton).
// Set PRINTFUL_KIDS_HEAVYWEIGHT_TEE_VARIANT_ID from `/v2/catalog-products/{id}/catalog-variants`.
//
// Youth sports tee (moisture-wicking): Gildan 8000B — DryBlend Youth T-Shirt (catalog product id ~787)
// https://www.printful.com/custom/kids-teen/t-shirts/youth-sports-tee-gildan-8000b
// This blank uses DTF (dtfilm + front_dtf), not DTG — see DEFAULTS and env overrides.
// Set PRINTFUL_KIDS_SPORTS_TEE_VARIANT_ID (e.g. Black/M → 20051).
//
// Adult unisex tee: Bella + Canvas 3001 — Unisex Staple Tee (catalog product id ~71).
// https://www.printful.com/custom/collections/bestsellers/unisex-staple-t-shirt-bella-canvas-3001
// DTG chest (`front`). Set PRINTFUL_TSHIRT_VARIANT_ID from `/v2/catalog-products/{id}/catalog-variants`.
//
// Joggers (adults): Cotton Heritage M7580 — Unisex Fleece Sweatpants (catalog product id ~412).
// https://www.printful.com/custom/mens/sweatpants-joggers/unisex-fleece-sweatpants-cotton-heritage-m7580
// DTG on outer leg uses API placement `leg_left` (embroidery uses separate placement keys — override env if needed).
// Set PRINTFUL_JOGGERS_VARIANT_ID from `/v2/catalog-products/{id}/catalog-variants`.
//
// Stickers: kiss-cut vinyl (home & living line; catalog product id ~358).
// https://www.printful.com/custom/home-living/all/kiss-cut-stickers
// Printable size follows the variant you pick (e.g. 3″, 4″ sheets). Set PRINTFUL_STICKER_VARIANT_ID accordingly
// and tune PRINTFUL_STICKER_PRINT_AREA_* if the placement editor should match that variant’s catalog box.
//
// Pillow: custom-shaped polyester pillow (catalog product id ~743).
// https://www.printful.com/custom/home-living/all/custom-shaped-pillow
// Variants map to printable dimensions (e.g. 16″×16″). Set PRINTFUL_PILLOW_VARIANT_ID from catalog-variants.
// Confirm `technique` / `placement` on `/v2/catalog-products/{id}` — defaults below match typical sublimation SKUs.
//
// Blanket: Port Authority BP40 — embroidered premium sherpa (catalog product id ~536).
// https://www.printful.com/custom/home-living/all/embroidered-premium-sherpa-blanket-port-authority-bp40
// Embroidery-only SKU — confirm `placement` / `technique` from `/v2/catalog-products/{id}` (`embroidery` + `embroidery_*` placement).
// Order payloads may require embroidery options (e.g. `embroidery_type`); defaults below are a starting point.
// Set PRINTFUL_BLANKET_VARIANT_ID from catalog-variants.
//
// Pet sweater: knitted pet sweater / knitwear (catalog product id ~964).
// https://www.printful.com/custom/home-living/all/knitted-pet-sweater
// Confirm `technique` / `placement` from `/v2/catalog-products/{id}` — defaults assume embroidery chest (`embroidery_front`).
// Set PRINTFUL_PET_SWEATER_VARIANT_ID from catalog-variants (sizes/colors merge from catalog on publish).
//
// Tote bag: Econscious EC8000 — organic cotton twill tote (catalog product id ~367).
// https://www.printful.com/custom/accessories/all/eco-tote-bag-econscious-ec8000
// Often DTG `front`; same catalog line supports embroidery — override technique/placement via env if you sell embroidered SKUs.
// Set PRINTFUL_TOTE_BAG_VARIANT_ID from catalog-variants.
//
// Ornament: metal Christmas ornament — round / bell / oval / tree variants (catalog product id ~901).
// https://www.printful.com/custom/home-living/all/metal-christmas-ornament
// Confirm `technique` / `placement` from `/v2/catalog-products/{id}` — defaults assume digital single-sided panel (`default`).
// Set PRINTFUL_ORNAMENT_VARIANT_ID from catalog-variants (shape lives on the variant).
//
// Jigsaw puzzle (catalog product id ~534).
// https://www.printful.com/custom/home-living/all/jigsaw-puzzle
// Piece counts / finished sizes differ by variant — confirm technique + placement from `/v2/catalog-products/{id}`.
// Set PRINTFUL_PUZZLE_VARIANT_ID from catalog-variants.
//
// Embroidered patches: Gunold 003 / accessories line (catalog product id ~516).
// https://www.printful.com/custom/accessories/all/embroidered-patches
// Confirm `embroidery_*` placement + thread options from `/v2/catalog-products/{id}`. Order payloads may need embroidery extras.
// Set PRINTFUL_EMBROIDERED_PATCH_VARIANT_ID from catalog-variants (size / shape lives on the variant).
//
// Hardcover journal matte — lined notebook, wraparound cover print (catalog product id ~867).
// https://www.printful.com/custom/collections/bestsellers/hardcover-journal-matte
// https://www.printful.com/custom/stationery/notebooks/hardcover-journal-matte
// Confirm `technique` / `placement` + flat wrap dimensions from `/v2/catalog-products/{id}` — defaults assume cover wrap (`default`).
// Set PRINTFUL_HARDCOVER_JOURNAL_VARIANT_ID from catalog-variants (trim / paper lives on the variant).
//
// Set `PRINTFUL_*_VARIANT_ID` (hoodie / kids hoodie / kids tee / …) to the **catalog_variant_id** for the exact size+color
// SKU you want as the default (one ID per env value). Use v2 catalog endpoints to list them:
//   GET https://api.printful.com/v2/catalog-products
//   GET https://api.printful.com/v2/catalog-products/{catalog_product_id}/catalog-variants
//
// A `catalog_variant_id` in Printful uniquely identifies a SKU — a specific
// blank product in a specific size and color (e.g. "Bella+Canvas 3001 Unisex
// T-Shirt, white, M"). To create an order we need:
//
//   - catalog_variant_id  (required) — picks the blank product
//   - placement           (required) — where the design prints, e.g. "front"
//   - technique           (required) — printing technique, e.g. "dtg" for
//                                       direct-to-garment apparel,
//                                       "sublimation" for mugs
//
// The variant id varies by Printful catalog state and is therefore read from
// env vars. Placement and technique have sane defaults per product type but
// can be overridden in env if a different SKU needs them.
//
// To discover variant ids use:
//   GET https://api.printful.com/v2/catalog-products
//   GET https://api.printful.com/v2/catalog-products/{id}/catalog-variants

import type { ProductType } from "@/lib/types";

export interface PrintfulCatalogConfig {
  catalogVariantId: number;
  /** Direct-to-garment, sublimation, embroidery, etc. */
  technique: string;
  /** "front" | "back" | "left_sleeve" | … */
  placement: string;
}

interface DefaultsRow {
  technique: string;
  placement: string;
}

// Sensible defaults so a catalog config only requires the variant id in env
// for the common case. Override via `PRINTFUL_<TYPE>_TECHNIQUE` /
// `PRINTFUL_<TYPE>_PLACEMENT` if you pick a SKU that uses something
// different (e.g. an all-over-print blueprint or an embroidered version).
//
// Each entry was verified against Printful's `/v2/catalog-products/{id}`
// `placements` field for our default SKU (see .env.local for the variant
// → product mapping). If you change the env *_VARIANT_ID, you may also
// need to update the placement/technique here or via env override.
const DEFAULTS: Record<ProductType, DefaultsRow> = {
  // Apparel: direct-to-garment, chest print
  tshirt: { technique: "dtg", placement: "front" },
  hoodie: { technique: "dtg", placement: "front" },
  // Youth pullover fleece — DTG on front chest (confirmed on catalog_products/533 placements).
  "kids-hoodie": { technique: "dtg", placement: "front" },
  "kids-heavyweight-tee": { technique: "dtg", placement: "front" },
  "kids-long-sleeve": { technique: "dtg", placement: "front" },
  "kids-tshirt": { technique: "dtg", placement: "front" },
  // Gildan 8000B youth — catalog offers DTF placements only on this SKU (front_dtf / dtfilm).
  "kids-sports-tee": { technique: "dtfilm", placement: "front_dtf" },
  // Cotton Heritage M7580 — DTG leg strip (`leg_left`); confirm placements if you swap SKU.
  joggers: { technique: "dtg", placement: "leg_left" },
  // Sublimation onto the whole mug surface
  mug: { technique: "sublimation", placement: "default" },
  // Wide-format poster — digital print (single-sided).
  poster: { technique: "digital", placement: "default" },
  // Kiss-cut stickers (~358) — digital; confirm `placement` / technique if you switch to die-cut or another SKU.
  sticker: { technique: "digital", placement: "default" },
  // Custom-shaped pillow (~743) — sublimation on polyester; confirm via catalog if Printful changes blueprint.
  pillow: { technique: "sublimation", placement: "default" },
  // BP40 sherpa (~536) — embroidery; placement key must match catalog `embroidery_*` file id (often `embroidery_front`).
  blanket: { technique: "embroidery", placement: "embroidery_front" },
  // Knitted pet sweater (~964) — typically embroidered motif; confirm placement key on catalog product.
  "pet-sweater": { technique: "embroidery", placement: "embroidery_front" },
  // All-Over Print backpack: cut-sew technique, front panel is the main print
  backpack: { technique: "cut-sew", placement: "front" },
  // Snap case: sublimation onto the entire back
  "phone-case": { technique: "sublimation", placement: "default" },
  // EC8000 tote (~367) — DTG front panel is typical; confirm on catalog if you use embroidery-only variants.
  "tote-bag": { technique: "dtg", placement: "front" },
  // Metal ornament (~901) — UV/digital-style rigid print; confirm technique key on catalog if Printful differs.
  ornament: { technique: "digital", placement: "default" },
  // Jigsaw (~534) — printed puzzle face; confirm via catalog if technique differs from `digital`.
  puzzle: { technique: "digital", placement: "default" },
  // Gunold patches (~516) — embroidery from uploaded art; confirm placement key on catalog.
  "embroidered-patch": { technique: "embroidery", placement: "embroidery_front" },
  // Matte hardcover journal (~867) — wraparound cover; confirm technique on catalog (sublimation vs digital UV).
  "hardcover-journal": { technique: "sublimation", placement: "default" },
};

const ENV_KEY_BY_TYPE: Record<ProductType, string> = {
  tshirt: "TSHIRT",
  hoodie: "HOODIE",
  "kids-hoodie": "KIDS_HOODIE",
  "kids-heavyweight-tee": "KIDS_HEAVYWEIGHT_TEE",
  "kids-long-sleeve": "KIDS_LONG_SLEEVE",
  "kids-tshirt": "KIDS_TSHIRT",
  "kids-sports-tee": "KIDS_SPORTS_TEE",
  joggers: "JOGGERS",
  mug: "MUG",
  poster: "POSTER",
  sticker: "STICKER",
  pillow: "PILLOW",
  blanket: "BLANKET",
  "pet-sweater": "PET_SWEATER",
  backpack: "BACKPACK",
  "phone-case": "PHONE_CASE",
  "tote-bag": "TOTE_BAG",
  ornament: "ORNAMENT",
  puzzle: "PUZZLE",
  "embroidered-patch": "EMBROIDERED_PATCH",
  "hardcover-journal": "HARDCOVER_JOURNAL",
};

function readFloatEnv(envKey: string): number | undefined {
  const raw = process.env[envKey];
  if (!raw) return undefined;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

function readIntEnv(envKey: string): number | undefined {
  const raw = process.env[envKey];
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Nominal print-area size for editor preview + Printful `position`.
 *
 * Per-SKU values come from Printful's
 * `GET /v2/catalog-variants/{id}.placement_dimensions[<placement>]` field
 * for the variant you've configured in env. They are the *maximum* printable
 * box on the placement (e.g. "front" / "leg_left"); Printful accepts any
 * sub-rectangle, but our editor and order layer both use the full box so
 * creators get the same on-garment scale they see in the editor.
 *
 * For SKUs without an env-configured variant we fall back to a generic
 * placeholder; once you set `PRINTFUL_<TYPE>_VARIANT_ID` you should also
 * verify the dims here (or override via `PRINTFUL_<TYPE>_PRINT_AREA_*_IN`
 * env vars and re-run `scripts/printful-refresh-blanks.mts` so the DB
 * cache picks them up alongside the blank mockup).
 *
 * The DB cache layer (`printful_blank_mockups.print_area_*_in`) takes
 * precedence over these defaults server-side when present — see
 * `getCachedPrintAreaInches`.
 */
const DEFAULT_PRINT_AREA_IN: Partial<Record<ProductType, { w: number; h: number }>> = {
  // Gildan 18500 Unisex Heavy Blend Hoodie (catalog_product_id 146).
  // `placement_dimensions.front`: 14×14 — square, NOT 12×15. Printful's
  // editor draws the print box at this exact size on its Flat 2 mockup.
  hoodie: { w: 14, h: 14 },
  // Bella + Canvas 3001 (catalog_product_id 71). `front`: 12×16.
  tshirt: { w: 12, h: 16 },
  // Kids variants tracked separately so we don't reuse the adult 14×14 box.
  // Verify per SKU once env IDs are set; values below are conservative.
  "kids-hoodie": { w: 10, h: 12 },
  "kids-heavyweight-tee": { w: 10, h: 12 },
  "kids-long-sleeve": { w: 10, h: 12 },
  "kids-tshirt": { w: 10, h: 12 },
  "kids-sports-tee": { w: 10, h: 12 },
  // Jerzees 975MPR Unisex Joggers (catalog_product_id 412). `leg_left`: 3.5×14.5.
  joggers: { w: 3.5, h: 14.5 },
  // White Glossy Mug 11 oz (catalog_product_id ~19). `default`: 9×3.5.
  mug: { w: 9, h: 3.5 },
  // Enhanced Matte Paper Poster 12″×18″. `default`: 12×18.
  poster: { w: 12, h: 18 },
  // Kiss-Cut Stickers 3″×3″ (catalog_product_id 358). `default`: 3×3.
  sticker: { w: 3, h: 3 },
  // Custom-shaped pillow — nominal square print field for larger variants
  // (e.g. 16″); override per SKU once env IDs are set.
  pillow: { w: 16, h: 16 },
  // BP40 sherpa embroidery — nominal stitch box; real limits live on catalog.
  blanket: { w: 12, h: 12 },
  // Pet knit — nominal embroidery chest box.
  "pet-sweater": { w: 8, h: 8 },
  // All-Over Print Backpack (catalog_product_id ~462). `front`: 14.5×20.5.
  backpack: { w: 14.5, h: 20.5 },
  // iPhone snap case — varies per device variant. The default below is for
  // iPhone 15 Plus (`default`: 4.43×7.32); other models will be overridden
  // via the DB cache once their blank mockup runs.
  "phone-case": { w: 4.43, h: 7.32 },
  // EC8000 tote (~367) — front print rectangle; verify per SKU.
  "tote-bag": { w: 14, h: 16 },
  // Metal ornament panel — shape varies (round, bell, oval, tree).
  ornament: { w: 3, h: 3 },
  // Jigsaw puzzle face — varies by piece count / finished size.
  puzzle: { w: 11, h: 14 },
  // Patch stitch field — varies by patch shape / backing.
  "embroidered-patch": { w: 4, h: 4 },
  // Wraparound cover flat — verify against catalog placement template.
  "hardcover-journal": { w: 17, h: 9 },
};

export function getPrintAreaInches(productType: ProductType): { width: number; height: number } | null {
  const key = ENV_KEY_BY_TYPE[productType];
  const base = DEFAULT_PRINT_AREA_IN[productType];
  if (!key || !base) return null;
  const w = readFloatEnv(`PRINTFUL_${key}_PRINT_AREA_WIDTH_IN`) ?? base.w;
  const h = readFloatEnv(`PRINTFUL_${key}_PRINT_AREA_HEIGHT_IN`) ?? base.h;
  if (!(w > 0 && h > 0)) return null;
  return { width: w, height: h };
}

/** Stable env var suffix for diagnostics (e.g. `PRINTFUL_KIDS_HOODIE_VARIANT_ID`). */
export function printfulCatalogVariantEnvName(productType: ProductType): string {
  const key = ENV_KEY_BY_TYPE[productType];
  return key ? `PRINTFUL_${key}_VARIANT_ID` : "PRINTFUL_<UNKNOWN>_VARIANT_ID";
}

export function getCatalogConfig(
  productType: ProductType,
): PrintfulCatalogConfig | null {
  const key = ENV_KEY_BY_TYPE[productType];
  if (!key) return null;

  const catalogVariantId = readIntEnv(`PRINTFUL_${key}_VARIANT_ID`);
  if (!catalogVariantId) return null;

  const defaults = DEFAULTS[productType];
  return {
    catalogVariantId,
    technique: process.env[`PRINTFUL_${key}_TECHNIQUE`] || defaults.technique,
    placement: process.env[`PRINTFUL_${key}_PLACEMENT`] || defaults.placement,
  };
}
