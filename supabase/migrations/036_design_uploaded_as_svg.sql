-- Track SVG uploads separately from the rasterized PNG we store. Used to
-- surface a print-preview caveat only when a transparent SVG may look
-- different on the garment than in the browser preview.
alter table public.designs
  add column if not exists uploaded_as_svg boolean;

comment on column public.designs.uploaded_as_svg is
  'True when the creator originally uploaded an SVG file (we rasterize to PNG for storage/Printful). Null/false for AI-generated designs and raster uploads.';
