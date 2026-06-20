-- Multi-storefront listing links.
--
-- Products currently carry a single `storefront_id`. To let one listing appear
-- in many storefronts, we introduce a join table and backfill from the existing
-- column. We keep `products.storefront_id` for backward compatibility and treat
-- it as the primary/default storefront in app code.

create table if not exists public.product_storefronts (
  product_id uuid not null references public.products(id) on delete cascade,
  storefront_id uuid not null references public.storefronts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, storefront_id)
);

create index if not exists product_storefronts_storefront_idx
  on public.product_storefronts(storefront_id);

alter table public.product_storefronts enable row level security;

drop policy if exists "product_storefronts_public_read" on public.product_storefronts;
create policy "product_storefronts_public_read" on public.product_storefronts
  for select using (true);

drop policy if exists "product_storefronts_owner_manage" on public.product_storefronts;
create policy "product_storefronts_owner_manage" on public.product_storefronts
  for all
  using (
    product_id in (
      select p.id
      from public.products p
      join public.profiles pr on pr.id = p.profile_id
      join public.parents pa on pa.id = pr.parent_id
      where pa.auth_user_id = auth.uid()
    )
  )
  with check (
    product_id in (
      select p.id
      from public.products p
      join public.profiles pr on pr.id = p.profile_id
      join public.parents pa on pa.id = pr.parent_id
      where pa.auth_user_id = auth.uid()
    )
  );

-- Backfill from legacy single-storefront column.
insert into public.product_storefronts (product_id, storefront_id)
select p.id, p.storefront_id
from public.products p
where p.storefront_id is not null
on conflict do nothing;
