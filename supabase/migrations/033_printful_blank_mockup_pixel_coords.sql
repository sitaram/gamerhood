-- Pixel-space print-area coordinates per Printful variant.
--
-- The placement editor / on-merch previews draw a cyan dashed frame over
-- the rendered flat blank mockup. Pre-this-migration, the frame was
-- positioned with hand-tuned percentages from `photoBand` in
-- `src/lib/create/merch-preview-layout.ts` — those were calibrated
-- visually against the mockup-tasks rendering and drifted significantly
-- from Printful's actual print area (e.g. for the Gildan 18500 hoodie our
-- frame's top was 38 % vs Printful's authoritative 21.7 %, and our frame
-- was ~29 % smaller in area — pushing the print box down into the
-- kangaroo pocket instead of staying on the chest).
--
-- Printful's v1 `/mockup-generator/templates/{catalog_product_id}` endpoint
-- exposes the per-(variant, placement) print-area rectangle in pixel space
-- on the template image. `fetchVariantPrintAreaPx` scales it into the
-- mockup-tasks output frame (typically 1200×1200) so client surfaces just
-- divide by `mockup_width_px` / `mockup_height_px` to get the percentages.
--
-- All columns are nullable: variants without a v1 template (some
-- embroidery / cut-sew / knitwear SKUs) keep falling back to photoBand.
--
-- Idempotent (`add column if not exists`) so re-running on environments
-- that picked up the columns out-of-band (the staging DB had them added
-- ahead of this migration) is a no-op.

alter table public.printful_blank_mockups
  add column if not exists mockup_width_px integer,
  add column if not exists mockup_height_px integer,
  add column if not exists print_area_x_px numeric(8, 2),
  add column if not exists print_area_y_px numeric(8, 2),
  add column if not exists print_area_w_px numeric(8, 2),
  add column if not exists print_area_h_px numeric(8, 2),
  add column if not exists template_id integer;

comment on column public.printful_blank_mockups.mockup_width_px is
  'Width in pixels of the rendered mockup served at `mockup_url`. Pair with `*_px` columns to compute placement percentages.';
comment on column public.printful_blank_mockups.mockup_height_px is
  'Height in pixels of the rendered mockup served at `mockup_url`.';
comment on column public.printful_blank_mockups.print_area_x_px is
  'Left offset of the print box in mockup-pixel space. Source: v1 /mockup-generator/templates print_area_left scaled to mockup_width_px.';
comment on column public.printful_blank_mockups.print_area_y_px is
  'Top offset of the print box in mockup-pixel space.';
comment on column public.printful_blank_mockups.print_area_w_px is
  'Print box width in mockup-pixel space.';
comment on column public.printful_blank_mockups.print_area_h_px is
  'Print box height in mockup-pixel space.';
comment on column public.printful_blank_mockups.template_id is
  'Printful v1 template_id the pixel coords were derived from; useful for diagnostics + drift checks.';
