-- Platform-curated browse categories (game/tag SEO landings like /fortnite/hoodies).

alter table public.browse_categories
  add column if not exists is_platform boolean not null default false;

create index if not exists idx_browse_categories_platform
  on public.browse_categories (is_platform)
  where is_platform = true;
