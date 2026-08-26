-- F02: flights table. RLS deferred to F05.

create table public.flights (
  id uuid primary key default gen_random_uuid(),
  flight_number text not null,
  airport_id uuid not null references public.airports(id) on delete restrict,
  scheduled_arrival_at timestamptz not null,
  estimated_arrival_at timestamptz,
  actual_arrival_at timestamptz,
  status flight_status not null default 'scheduled',
  terminal text,
  delay_minutes integer,
  last_synced_at timestamptz,
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index flights_flight_number_idx on public.flights(flight_number);
create index flights_airport_id_idx on public.flights(airport_id);

create trigger set_flights_updated_at
  before update on public.flights
  for each row
  execute function set_updated_at();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists set_flights_updated_at on public.flights;
-- drop index if exists flights_airport_id_idx;
-- drop index if exists flights_flight_number_idx;
-- drop table if exists public.flights;
