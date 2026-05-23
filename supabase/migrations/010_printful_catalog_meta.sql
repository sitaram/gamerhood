-- Printful catalog snapshot: supplier description + size guides + stable product id

alter table public.products
  add column if not exists printful_catalog_product_id integer;

alter table public.products
  add column if not exists printful_catalog_meta jsonb;

comment on column public.products.printful_catalog_product_id is
  'Printful catalog_product_id from GET /v2/catalog-variants/{id}';

comment on column public.products.printful_catalog_meta is
  'Normalized snapshot: blankDescription, availableSizes, catalogColors, sizeGuides from Printful catalog APIs';
