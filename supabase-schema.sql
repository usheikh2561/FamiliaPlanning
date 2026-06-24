-- ============================================================
--  FamiliaPlanning — database setup
--
--  Copy ALL of this, paste it into the Supabase "SQL Editor",
--  and click "Run". It creates the two tables the app needs.
--  (SETUP.md explains where to find the SQL Editor.)
--
--  NOTE: If you ran an older version of this file before, run the
--  "RESET" block at the very bottom first, then run everything.
-- ============================================================

-- People who are planning.
create table if not exists members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- Each person's status for a specific calendar day.
-- A "free" day is simply NOT stored here (free is the default).
create table if not exists entries (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references members(id) on delete cascade,
  date       date not null,                          -- e.g. 2026-07-04
  status     text not null check (status in ('maybe', 'busy')),
  reason     text,                                   -- e.g. 'work', 'vacation'
  created_at timestamptz not null default now(),
  -- One entry per person per day (lets the app "upsert").
  unique (member_id, date)
);

-- ------------------------------------------------------------
--  Access rules (Row Level Security)
--  Private family tool: allow the public "anon" key to read/write,
--  since only people you share the link with can reach the app.
--  Ask anytime if you'd like to add per-person logins later.
-- ------------------------------------------------------------
alter table members enable row level security;
alter table entries enable row level security;

drop policy if exists "family can do anything with members" on members;
drop policy if exists "family can do anything with entries" on entries;

create policy "family can do anything with members"
  on members for all using (true) with check (true);

create policy "family can do anything with entries"
  on entries for all using (true) with check (true);

-- ============================================================
--  RESET (optional) — only if you set up an OLDER version before.
--  Uncomment these two lines, run them once, then run everything above.
-- ============================================================
-- drop table if exists availability;
-- drop table if exists entries;
