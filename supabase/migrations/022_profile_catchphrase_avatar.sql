-- Kid-friendly creator personalization: short catchphrase on profiles.
-- avatar_url already exists on profiles (001_initial_schema.sql).

alter table public.profiles
  add column if not exists catchphrase text;

comment on column public.profiles.catchphrase is
  'Optional short signature line shown on the creator storefront (e.g. "Level 99 builder").';
