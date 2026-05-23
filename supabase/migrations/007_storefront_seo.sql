-- Creator storefront homepage + SEO, and per-product tags/category for discovery.

alter table public.profiles
  add column if not exists storefront_hero_image_url text,
  add column if not exists storefront_headline text,
  add column if not exists storefront_subhead text,
  add column if not exists storefront_hero_overlay text
    default 'dark'
    check (storefront_hero_overlay in ('none', 'dark', 'light', 'gradient')),
  add column if not exists store_seo_title text,
  add column if not exists store_seo_description text,
  add column if not exists store_tags text[] default '{}'::text[];

create index if not exists idx_profiles_store_tags on public.profiles using gin (store_tags);

alter table public.products
  add column if not exists tags text[] default '{}'::text[],
  add column if not exists category text,
  add column if not exists seo_description text;

create index if not exists idx_products_category on public.products (category)
  where category is not null and is_published = true;

create index if not exists idx_products_tags on public.products using gin (tags);
