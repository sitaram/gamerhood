-- Creator-adjusted artwork position for Printful file layers (chest/front DTG etc.)
alter table public.products
  add column if not exists print_placement jsonb default null;

comment on column public.products.print_placement is
  'Optional { zoom, panX, panY, imageAspect } for Printful layer position — see lib/print/placement.ts';
