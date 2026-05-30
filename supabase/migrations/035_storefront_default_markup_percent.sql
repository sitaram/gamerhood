-- Per-storefront default markup for the /create publish-flow pricing step.
--
-- The inline "Set your price" card on /create (src/components/create/
-- merch-pricing-step.tsx) seeds every product type at this percent above
-- the per-listing base cost. Creators can still slide each row up or
-- down before publishing; this value just decides where the slider
-- starts on first paint.
--
-- Stored per-storefront (not per-user) so a creator with multiple shops
-- can carry a different default on each — e.g. a fan-art shop priced
-- aggressively at 5% while a personal-brand shop runs at 30%. NOT NULL
-- with a 10 default so the publish endpoint can read it without a
-- coalesce on every row.
--
-- 0..100 check guards against bad seeds; the publish endpoint still
-- enforces the take-home floor server-side (computeBaseCost) so a 0%
-- default can't accidentally ship merch at a loss.

alter table public.storefronts
  add column if not exists default_markup_percent integer not null default 10;

alter table public.storefronts
  drop constraint if exists storefronts_default_markup_percent_range;

alter table public.storefronts
  add constraint storefronts_default_markup_percent_range
  check (default_markup_percent between 0 and 100);
