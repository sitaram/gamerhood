-- Cache for Printful flat blank product mockups.
--
-- One row per product_type (which maps to a single configured
-- catalog_variant_id via env / catalog.ts). The mockup_url is the result of
-- a `/v2/mockup-tasks` job rendered with a Flat mockup style and a
-- transparent dummy design layer — i.e. it's a clean flat photo of the
-- blank product without any model or design.
--
-- Public read so the client placement editor can display the URL directly.
-- Writes are service-role only (see lib/printful/blank-mockup.ts).

create table if not exists public.printful_blank_mockups (
  product_type text primary key,
  mockup_url text not null,
  catalog_product_id integer,
  catalog_variant_id integer,
  mockup_style_id integer,
  technique text,
  placement text,
  generated_at timestamptz not null default now()
);

alter table public.printful_blank_mockups enable row level security;

drop policy if exists "printful_blank_mockups_public_read" on public.printful_blank_mockups;

create policy "printful_blank_mockups_public_read"
  on public.printful_blank_mockups
  for select
  using (true);

-- No insert/update/delete policies → only service role can write.
