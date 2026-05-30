-- Per-storefront defaults for the /create publish form.
--
-- The publish flow asks sellers to enter a description, tags, and a
-- category slug for every batch of merch. Today those fields are blank
-- on each publish — sellers feel like their previous inputs were lost
-- even though the underlying products carry them. This migration lets a
-- seller set explicit defaults on the storefront so /create can pre-fill
-- them; when unset, the publish flow falls back to copying the most
-- recent published listing on the same storefront. Defaults are stored
-- per-storefront (not per-user) so a creator with multiple shops can
-- keep distinct copy for each.
--
-- All three columns are nullable: brand-new sellers (and anyone who
-- doesn't bother setting defaults) still get the same blank form they
-- had before. `default_tags` uses text[] to match the storage shape of
-- `products.tags` (added in 007); the publish endpoint already accepts
-- a comma-separated string from the client and parses it into an array
-- via `parseTagsInput`, so the on-disk shape matches what we actually
-- write at publish time.

alter table public.storefronts
  add column if not exists default_description text,
  add column if not exists default_tags text[],
  add column if not exists default_category_slug text;
