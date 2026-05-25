-- Per-listing cost basis used by the post-publish price editor.
--
-- `wholesale_price_cents` — what Printful charges us to produce one unit of
-- the chosen catalog variant (default size/color). Populated at publish time
-- from Printful's catalog pricing endpoint; back-filled lazily on first
-- pricing edit when the publish-time fetch missed (or pre-existing rows).
--
-- `shipping_estimate_cents` — US-domestic standard-shipping cost for the
-- first unit in an order. We disclose "estimated, US domestic" in the editor
-- and FAQ so creators understand international orders may reduce take-home
-- slightly.
--
-- Both nullable: legacy rows stay readable, and the editor falls back to the
-- per-product-type defaults in `src/lib/pricing/product-costs.ts` when the
-- column is NULL. The take-home math always has *some* basis to enforce a
-- floor against — it never silently lets a creator price below cost.

alter table public.products
  add column if not exists wholesale_price_cents integer,
  add column if not exists shipping_estimate_cents integer;

comment on column public.products.wholesale_price_cents is
  'Printful wholesale cost (cents) for the default catalog variant. Source of truth for the take-home floor in /dashboard/storefront. NULL = use defaults from src/lib/pricing/product-costs.ts.';
comment on column public.products.shipping_estimate_cents is
  'Estimated US-domestic standard-shipping cost (cents) for one unit. Used to compute the price floor; international orders may reduce take-home slightly. NULL = use defaults from src/lib/pricing/product-costs.ts.';
