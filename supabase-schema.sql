-- ============================================================
--  FamiliaPlanning — database setup
--
--  Copy ALL of this, paste it into the Supabase "SQL Editor",
--  and click "Run". It creates the two tables the app needs.
--  (SETUP.md explains where to find the SQL Editor.)
-- ============================================================

-- People who are planning.
create table if not exists members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- Each person's answer for each weekend.
create table if not exists availability (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references members(id) on delete cascade,
  weekend    text not null,                       -- e.g. "2026-06-27"
  status     text not null check (status in ('free', 'maybe', 'busy')),
  created_at timestamptz not null default now(),
  -- One answer per person per weekend (lets the app "upsert").
  unique (member_id, weekend)
);

-- ------------------------------------------------------------
--  Access rules (Row Level Security)
--
--  This is a private family tool, so we allow the public "anon"
--  key to read and write. That's fine because only people you
--  share the link with can reach the app. If you later want
--  logins, we can tighten these rules.
-- ------------------------------------------------------------
alter table members enable row level security;
alter table availability enable row level security;

create policy "family can do anything with members"
  on members for all using (true) with check (true);

create policy "family can do anything with availability"
  on availability for all using (true) with check (true);
