-- Marketplace SEO categories: slug matches URL `/{slug}/{merch}` and products.category / tags.

create table public.browse_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  seo_title text,
  seo_description text,
  keywords text[] default '{}'::text[],
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_browse_categories_slug_lookup on public.browse_categories (slug);

drop trigger if exists trg_browse_categories_updated_at on public.browse_categories;
create trigger trg_browse_categories_updated_at
  before update on public.browse_categories
  for each row execute function public.set_updated_at();

alter table public.browse_categories enable row level security;

create policy "browse_categories_select_all" on public.browse_categories
  for select using (true);

create policy "browse_categories_insert_own" on public.browse_categories
  for insert
  with check (auth.uid() = created_by);

create policy "browse_categories_update_own" on public.browse_categories
  for update using (auth.uid() = created_by);

create policy "browse_categories_delete_own" on public.browse_categories
  for delete using (auth.uid() = created_by);
