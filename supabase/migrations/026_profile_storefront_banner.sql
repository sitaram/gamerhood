-- Optional per-creator banner background image shown ONLY behind the top
-- section of the public storefront (`/shop/[slug]`). When NULL (the default),
-- the storefront falls back to the existing dark grid header — no behavioral
-- change for creators who haven't uploaded one.
--
-- Sibling of `storefront_avatar_url` (migration 024) — same access pattern:
-- the column is publicly readable so server-rendered `/shop/[slug]` can
-- display the image, and the owning parent manages writes via PATCH on
-- `/api/account/profile`.
--
-- RLS: covered by the existing policies on `public.profiles` from
-- 001_initial_schema.sql:
--   - `profiles_parent_manage` (for all) lets the owning parent read/write
--     every column on their child profile, this one included.
--   - `profiles_public_read` (for select, is_active = true) lets anyone
--     read the column on a live storefront — required so server-rendered
--     `/shop/[slug]` pages can render the banner.

alter table public.profiles
  add column if not exists storefront_banner_url text;

comment on column public.profiles.storefront_banner_url is
  'Optional public-shop-only background image for the /shop/[slug] header section. NULL means use the default gradient header.';
