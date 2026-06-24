-- ============================================================
--  FamiliaPlanning — database setup
--
--  HOW TO USE: In your Supabase project, open the "SQL Editor",
--  click "New query", paste ALL of this, and click "Run".
--  You should see "Success. No rows returned."
--
--  Safe to run again anytime — it cleans up and recreates the
--  tables and permissions from scratch. (You only have test data
--  right now, so a clean reset is fine.)
-- ============================================================

-- 1) Start clean. Drops old/partial setups (including the very first
--    version that used an "availability" table).
drop table if exists entries cascade;
drop table if exists availability cascade;
drop table if exists members cascade;

-- 2) People who are planning.
create table members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- 3) Each person's status for a specific calendar day.
--    A "free" day is simply NOT stored here (free is the default).
create table entries (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references members(id) on delete cascade,
  date       date not null,                          -- e.g. 2026-07-04
  status     text not null check (status in ('maybe', 'busy')),
  reason     text,                                   -- e.g. 'work', 'vacation'
  created_at timestamptz not null default now(),
  -- One entry per person per day (lets the app "upsert").
  unique (member_id, date)
);

-- 4) Permissions (Row Level Security).
--    The newer Supabase "publishable" key REQUIRES these policies,
--    or every read/write is silently denied. Private family tool:
--    anyone with the link can read/write. Ask anytime to add logins.
alter table members enable row level security;
alter table entries enable row level security;

create policy "family read members"   on members for select using (true);
create policy "family write members"  on members for insert with check (true);
create policy "family update members" on members for update using (true) with check (true);
create policy "family delete members" on members for delete using (true);

create policy "family read entries"   on entries for select using (true);
create policy "family write entries"  on entries for insert with check (true);
create policy "family update entries" on entries for update using (true) with check (true);
create policy "family delete entries" on entries for delete using (true);
