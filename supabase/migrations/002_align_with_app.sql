-- Align schema with application code (queries.ts, routes, etc.)
-- Adds missing columns, constraints, and RLS policies that were assumed by
-- the application but never declared in 001_initial_schema.sql.

-- ── profiles: parent_id must be unique to support upsert(onConflict: "parent_id")
-- One creator profile per parent for now; revisit if/when multi-child is added.
alter table public.profiles
  add constraint profiles_parent_id_unique unique (parent_id);

-- ── orders: track Stripe Checkout session id and shipping recipient name
alter table public.orders
  add column if not exists stripe_session_id text,
  add column if not exists shipping_name text;

create unique index if not exists orders_stripe_session_id_unique
  on public.orders (stripe_session_id)
  where stripe_session_id is not null;

create index if not exists idx_orders_printify on public.orders (printify_order_id);

-- ── designs: keep all "moderation context" together; default to pending
-- (moderation_notes / content_safe / copyright_clear already exist)
-- Add an index on (profile_id, created_at desc) for dashboard listing.
create index if not exists idx_designs_profile_created
  on public.designs (profile_id, created_at desc);

-- ── dmca_reports: design_id should be nullable so we can record reports
-- about content where the URL doesn't resolve to a known design.
alter table public.dmca_reports
  alter column design_id drop not null;

-- ── RLS for tables that were missing it
-- dmca_reports: anyone can submit (form is public), only service role can read.
alter table public.dmca_reports enable row level security;

-- Allow anonymous submissions of DMCA reports
create policy "dmca_reports_public_insert" on public.dmca_reports
  for insert with check (true);

-- copyright_strikes: parents can read strikes against their child profiles
alter table public.copyright_strikes enable row level security;

create policy "copyright_strikes_parent_read" on public.copyright_strikes
  for select using (
    profile_id in (
      select p.id from public.profiles p
      join public.parents pa on pa.id = p.parent_id
      where pa.auth_user_id = auth.uid()
    )
  );

-- badges: read-only catalog for everyone
alter table public.badges enable row level security;

create policy "badges_public_read" on public.badges
  for select using (true);

-- profile_badges: anyone can read badges earned by an active profile
alter table public.profile_badges enable row level security;

create policy "profile_badges_public_read" on public.profile_badges
  for select using (
    profile_id in (select id from public.profiles where is_active = true)
  );

create policy "profile_badges_parent_manage" on public.profile_badges
  for all using (
    profile_id in (
      select p.id from public.profiles p
      join public.parents pa on pa.id = p.parent_id
      where pa.auth_user_id = auth.uid()
    )
  );

-- ── updated_at maintenance trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_parents_updated_at on public.parents;
create trigger trg_parents_updated_at
  before update on public.parents
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();
