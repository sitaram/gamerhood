-- Optional per-creator override photo shown ONLY on the public storefront
-- (`/shop/[slug]`). The existing `avatar_url` stays in charge of the
-- nav, dashboard, design cards, and creator-spotlight surfaces.
--
-- When NULL (the default), the storefront falls back to `avatar_url`, and
-- then to a deterministic axolotl from `DEFAULT_AVATAR_POOL` — see
-- `src/lib/profile-avatar.ts#getStorefrontAvatar`.
--
-- RLS: covered by the existing policies on `public.profiles` from
-- 001_initial_schema.sql:
--   - `profiles_parent_manage` (for all) lets the owning parent read/write
--     every column on their child profile, this one included.
--   - `profiles_public_read` (for select, is_active = true) lets anyone
--     read the column on a live storefront — required so server-rendered
--     `/shop/[slug]` pages can display the override.

alter table public.profiles
  add column if not exists storefront_avatar_url text;

comment on column public.profiles.storefront_avatar_url is
  'Optional public-shop-only override for avatar_url. When set, /shop/[slug] shows this image; everywhere else on the site still shows avatar_url.';
