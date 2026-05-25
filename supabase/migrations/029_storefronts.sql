-- Multiple storefronts per user (v1: single-owner, shared Stripe + XP).
--
-- Until now the `profiles` row WAS the storefront — slug, banner, hero,
-- and storefront avatar all lived inline on the creator's profile and
-- `/shop/[slug]` looked up profiles directly. This migration introduces a
-- standalone `storefronts` table so a single profile can run several
-- public shops (personal, family, fandom, …) while still sharing XP /
-- level / tier badge / Stripe Connect (all of which stay keyed off
-- `profiles`).
--
-- Backwards compat:
--   * Existing `/shop/<slug>` URLs continue to resolve because every
--     profile with a slug is backfilled into `storefronts` here.
--   * `profiles.storefront_*` columns are NOT dropped — readers will
--     transition to `storefronts` over the next release. See
--     LAUNCH_CHECKLIST.md for the deprecation plan.
--   * `products.creator_id` doesn't exist in our schema — products link
--     to `profile_id`. We add `storefront_id` alongside (nullable) and
--     backfill from the owner's default storefront. `profile_id` stays
--     populated by code for the time being.
--
-- Auth chain for RLS: auth.users → parents.auth_user_id → parents.id →
-- profiles.parent_id → profiles.id → storefronts.owner_profile_id.

create table if not exists public.storefronts (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  catchphrase text,
  avatar_url text,
  banner_url text,
  hero_image_url text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists storefronts_owner_idx
  on public.storefronts(owner_profile_id);

-- At most one default storefront per owner. Multiple `is_default = false`
-- rows are fine; toggling the default is an atomic two-write op handled
-- by the API route.
create unique index if not exists storefronts_one_default_per_owner
  on public.storefronts(owner_profile_id) where is_default;

alter table public.storefronts enable row level security;

-- Storefronts are inherently public (they back `/shop/[slug]`). Anyone,
-- signed-in or not, can read them.
drop policy if exists "storefronts_public_read" on public.storefronts;
create policy "storefronts_public_read" on public.storefronts
  for select using (true);

-- Owner can mutate their own storefronts. Mirrors the auth chain used by
-- `profiles_parent_manage` / `xp_events_owner_read`. The service role
-- bypasses RLS entirely (used by route handlers that need to write
-- before the SSR client has the request cookies, e.g. the publish
-- endpoint).
drop policy if exists "storefronts_owner_manage" on public.storefronts;
create policy "storefronts_owner_manage" on public.storefronts
  for all
  using (
    owner_profile_id in (
      select p.id from public.profiles p
      join public.parents pa on pa.id = p.parent_id
      where pa.auth_user_id = auth.uid()
    )
  )
  with check (
    owner_profile_id in (
      select p.id from public.profiles p
      join public.parents pa on pa.id = p.parent_id
      where pa.auth_user_id = auth.uid()
    )
  );

-- ── Backfill: one storefront per existing profile that has a slug ──
-- Every active creator already has a storefront-shaped row on `profiles`;
-- we just need to materialize it in the new table. `is_default = true`
-- because today every creator has exactly one shop.
--
-- Conflict path on slug guards against an unlikely race with a manually
-- inserted row, and lets re-runs of this migration be idempotent.
insert into public.storefronts (
  owner_profile_id,
  slug,
  display_name,
  catchphrase,
  avatar_url,
  banner_url,
  hero_image_url,
  is_default
)
select
  p.id,
  p.slug,
  p.display_name,
  p.catchphrase,
  coalesce(p.storefront_avatar_url, p.avatar_url),
  p.storefront_banner_url,
  p.storefront_hero_image_url,
  true
from public.profiles p
where p.slug is not null
on conflict (slug) do nothing;

-- ── Link products to storefronts ──
alter table public.products
  add column if not exists storefront_id uuid
    references public.storefronts(id) on delete set null;

create index if not exists idx_products_storefront
  on public.products(storefront_id);

-- Backfill: each existing product attaches to its creator's default
-- storefront. Products keep their `profile_id` for now — the code keeps
-- writing both fields during the transition.
update public.products pr
   set storefront_id = s.id
  from public.storefronts s
 where pr.profile_id = s.owner_profile_id
   and s.is_default = true
   and pr.storefront_id is null;
