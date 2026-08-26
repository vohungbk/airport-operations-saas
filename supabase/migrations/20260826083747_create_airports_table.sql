-- F02: airports table (shared reference data). RLS deferred to F05.

create table public.airports (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  city text not null,
  country text not null,
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_airports_updated_at
  before update on public.airports
  for each row
  execute function set_updated_at();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists set_airports_updated_at on public.airports;
-- drop table if exists public.airports;
