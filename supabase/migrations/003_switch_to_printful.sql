-- Migration 003: switch fulfillment from Printify → Printful (v2 API).
--
-- What changed and why:
--
-- 1. Public storage bucket `design-images`.
--    Printful's order endpoint accepts a layer URL and fetches it server-side.
--    Our designs live as base64 data URLs in `designs.image_url`, which
--    Printful can't fetch — so we mint a public Supabase Storage URL on
--    publish and pass that.
--
-- 2. `products.printify_product_id` → DROPPED.
--    Printful doesn't have a per-design "sync product" step. We pass the
--    image URL directly with each order item, so there's nothing to mint
--    at publish time and nothing to store. (Sync products in Printful exist
--    for connecting to Shopify/Etsy storefronts, which we don't use.)
--
-- 3. New column `products.printful_catalog_variant_id`.
--    The earlier code referenced a `printify_variant_id` column that was
--    never actually in the schema (publish would silently drop it). With
--    Printful we genuinely need a per-product SKU id at order time, so we
--    add the column for real this time.
--
-- 4. `orders.printify_order_id` → `printful_order_id`.
--    Pure rename (text → text); existing index repointed.

-- ── Storage bucket ─────────────────────────────────────────────────────────
-- `public = true` makes objects readable by anyone with the URL — required
-- for Printful (and for product imagery on storefront pages). Writes happen
-- exclusively from server routes via the service-role client, so we don't
-- need to add an INSERT policy on storage.objects.
insert into storage.buckets (id, name, public)
values ('design-images', 'design-images', true)
on conflict (id) do nothing;

-- ── products ──────────────────────────────────────────────────────────────
alter table public.products
  drop column if exists printify_product_id;

alter table public.products
  add column if not exists printful_catalog_variant_id integer;

-- ── orders ────────────────────────────────────────────────────────────────
alter table public.orders
  rename column printify_order_id to printful_order_id;

drop index if exists idx_orders_printify;
create index if not exists idx_orders_printful
  on public.orders (printful_order_id);
