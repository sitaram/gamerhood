-- Creator XP rewards: per-profile event log + atomic award RPC.
--
-- Design notes:
-- - One row per (profile, dedupe_key) ensures idempotency for both one-shot
--   rules ("SIGNUP_WELCOME") and per-entity repeatable rules
--   ("PRODUCT_PUBLISHED:<product_id>"). Callers always pass a dedupe key.
-- - `profile_id` (not auth.users.id) — `profiles.xp` / `profiles.level`
--   already exist on the creator profile, which is what the storefront
--   actually renders against. This keeps everything in one row.
-- - `award_xp_event` runs as `security definer` so route handlers calling
--   it via the service-role client can mutate `profiles.xp` and
--   `xp_events` atomically without juggling RLS exceptions.
-- - Level thresholds mirror src/lib/xp/tiers.ts (Sprout / Spark /
--   Adventurer / Champion / Hero / Legendary / Mythical). Kept in sync
--   manually — small enough table that a duplicate constant is cheaper
--   than a join from SQL into TS.

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rule_key text not null,
  points int not null check (points >= 0),
  -- One-shot rules pass `dedupe_key = rule_key`; repeatable rules append
  -- the entity id (e.g. `PRODUCT_PUBLISHED:<product_id>`). The unique
  -- index below is what makes both flavors idempotent.
  dedupe_key text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists xp_events_profile_dedupe_unique
  on public.xp_events (profile_id, dedupe_key);

create index if not exists xp_events_profile_created
  on public.xp_events (profile_id, created_at desc);

alter table public.xp_events enable row level security;

-- Owner can read their own event log (powers the future "XP history"
-- view if we ever add one). Writes are service-role only via the RPC
-- below; no insert policy is granted to authenticated users.
create policy "xp_events_owner_read" on public.xp_events
  for select using (
    profile_id in (
      select p.id from public.profiles p
      join public.parents pa on pa.id = p.parent_id
      where pa.auth_user_id = auth.uid()
    )
  );

-- Atomic award: dedupe insert + xp/level increment in one round-trip.
-- Returns enough state for the caller to decide whether to fire a
-- celebration toast and whether to render a "tier up" message.
create or replace function public.award_xp_event(
  p_profile_id uuid,
  p_rule_key text,
  p_points int,
  p_dedupe_key text,
  p_metadata jsonb default null
)
returns table (
  awarded boolean,
  prev_xp int,
  new_xp int,
  prev_level int,
  new_level int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
  v_prev_xp int;
  v_prev_level int;
  v_new_xp int;
  v_new_level int;
begin
  select coalesce(xp, 0), coalesce(level, 1)
    into v_prev_xp, v_prev_level
    from public.profiles
   where id = p_profile_id;

  if v_prev_xp is null then
    -- No profile row → nothing to award against.
    return query select false, 0, 0, 1, 1;
    return;
  end if;

  insert into public.xp_events (profile_id, rule_key, points, dedupe_key, metadata)
  values (p_profile_id, p_rule_key, p_points, p_dedupe_key, p_metadata)
  on conflict (profile_id, dedupe_key) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    return query select false, v_prev_xp, v_prev_xp, v_prev_level, v_prev_level;
    return;
  end if;

  v_new_xp := v_prev_xp + p_points;
  -- Mirror src/lib/xp/tiers.ts. Update both files together if you re-tune.
  v_new_level := case
    when v_new_xp >= 6000 then 7
    when v_new_xp >= 3000 then 6
    when v_new_xp >= 1500 then 5
    when v_new_xp >= 700 then 4
    when v_new_xp >= 300 then 3
    when v_new_xp >= 100 then 2
    else 1
  end;

  update public.profiles
     set xp = v_new_xp,
         level = greatest(v_prev_level, v_new_level)
   where id = p_profile_id;

  return query select true, v_prev_xp, v_new_xp, v_prev_level, v_new_level;
end;
$$;

revoke all on function public.award_xp_event(uuid, text, int, text, jsonb) from public;
grant execute on function public.award_xp_event(uuid, text, int, text, jsonb)
  to service_role;
