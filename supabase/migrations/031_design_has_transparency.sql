-- Surface whether each uploaded / AI-generated design has a real alpha
-- channel — i.e. whether Printful will see transparent pixels and let the
-- garment colour show through, or whether the design will print as a solid
-- rectangle.
--
-- Why now: creators saw a checkered backdrop in the storefront mockup and
-- worried it would print literally. The checker is only ever a CSS / image-
-- preview convention for "this area is transparent", but several AI image
-- generators (Gemini, some web tools) actually BAKE a checker pattern into
-- the RGB pixels when asked for a "transparent background" — producing a
-- PNG with no alpha and a literal checker on top. Without an alpha-channel
-- check there's no way for the creator to know which case they're in until
-- they hold the printed garment.
--
-- We compute the value server-side via `sharp.metadata()` at upload/generate
-- time, and lazy-fill for legacy rows the first time a creator opens the
-- design in the edit screen. The badge UI reads this column, with `null`
-- meaning "we haven't checked yet" (rendered as a neutral "?" state).

alter table public.designs
  add column if not exists has_transparency boolean;

comment on column public.designs.has_transparency is
  'True when the design''s PNG/raster has an alpha channel containing at least one sub-255 pixel — i.e. it will print without a solid rectangle backdrop on Printful. Null means the check has not run yet (legacy row, or compute failed); the edit UI lazy-computes when it sees a null. Computed via sharp at design upload/generate time; surfaced as a "Transparent background ✓ / Solid background ✗" badge in the create flow and listing edit page.';
