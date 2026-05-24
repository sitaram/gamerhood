-- Cache per-SKU print area dimensions alongside the blank flat mockup.
--
-- These values come from
--   GET /v2/catalog-variants/{id}.placement_dimensions[<placement>]
-- and are the maximum printable box (in inches) for the variant's
-- configured placement (e.g. "front" for hoodie/tshirt, "leg_left" for
-- joggers). The editor and order layer use them to draw a print box that
-- matches Printful's own design maker.
--
-- The DB cache is the source of truth when present — the hardcoded
-- DEFAULT_PRINT_AREA_IN in src/lib/printful/catalog.ts is the fallback for
-- first render before a variant has been polled. The cache is populated
-- as a side-effect of generating the flat blank mockup (one round-trip
-- per SKU per environment lifetime).

alter table public.printful_blank_mockups
  add column if not exists print_area_width_in numeric(6, 3),
  add column if not exists print_area_height_in numeric(6, 3);

comment on column public.printful_blank_mockups.print_area_width_in is
  'Printful placement_dimensions[<placement>].width in inches (e.g. 14.0 for Gildan 18500 front)';
comment on column public.printful_blank_mockups.print_area_height_in is
  'Printful placement_dimensions[<placement>].height in inches (e.g. 14.0 for Gildan 18500 front)';
