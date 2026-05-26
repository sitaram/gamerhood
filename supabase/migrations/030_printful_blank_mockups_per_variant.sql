-- Per-variant photographic blanks for the storefront color picker.
--
-- Old schema keyed `printful_blank_mockups` by `product_type` (one row per
-- product line, photographed in the env-default color). When a buyer clicked
-- a non-default color, `ProductMockupImage` had no real photo to fall back
-- on and dropped to `MerchGarmentSilhouette` — an abstract tinted SVG. This
-- migration switches the table to one row per `catalog_variant_id`, so each
-- color (and, optionally, size) variant has its own re-hosted Printful
-- blank. The buyer sees a real garment photo regardless of color picked.
--
-- Track A in the new code path pulls the per-variant `image` straight from
-- `/v2/catalog-variants/{id}` and re-hosts to Supabase Storage — orders of
-- magnitude faster than `mockup-tasks` so we can warm every color (~30
-- variants/product) without spamming Printful's rate limits. Track B falls
-- back to mockup-tasks when the catalog photo is missing for a variant.
--
-- `catalog_variant_id` is globally unique across Printful's SKU space, so
-- it makes a fine standalone PK; `product_type` becomes a regular column
-- used for the storefront's `(product_type, color_name)` lookup index.

-- 1. Drop any rows that lack a variant id — they can be regenerated and
--    the new PK requires NOT NULL. Old code paths always populated
--    `catalog_variant_id`, so this should be a no-op in practice.
delete from public.printful_blank_mockups where catalog_variant_id is null;

-- 2. Switch the primary key from `product_type` to `catalog_variant_id`.
alter table public.printful_blank_mockups
  drop constraint if exists printful_blank_mockups_pkey;

alter table public.printful_blank_mockups
  alter column catalog_variant_id set not null;

alter table public.printful_blank_mockups
  add constraint printful_blank_mockups_pkey primary key (catalog_variant_id);

-- 3. Per-color metadata so the storefront can look up a blank by
--    (product_type, color_name) without round-tripping to Printful for the
--    color → variant_id mapping.
alter table public.printful_blank_mockups
  add column if not exists color_name text,
  add column if not exists color_hex text,
  add column if not exists source text;

create index if not exists printful_blank_mockups_type_color_idx
  on public.printful_blank_mockups (product_type, color_name);

comment on column public.printful_blank_mockups.color_name is
  'Printful catalog color name for this variant (e.g. "Heather Sport Dark Navy"). Used by the storefront color picker.';
comment on column public.printful_blank_mockups.color_hex is
  'Primary Printful color hex (`color_code`); kept for diagnostics.';
comment on column public.printful_blank_mockups.source is
  'Where the mockup_url came from: "catalog_image" (per-variant Printful photo, fast path) or "mockup_task" (mockup-generator job, slow fallback).';
