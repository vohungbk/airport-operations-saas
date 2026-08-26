-- F02: seats table. RLS deferred to F05.
-- public_token defaults to a UUID-shaped placeholder; the real public QR
-- token format is an F10 decision (plan.md open question 8).

create table public.seats (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique default gen_random_uuid()::text,
  serial_number text not null unique,
  manufacturer text not null,
  model text not null,
  category_id uuid not null references public.seat_categories(id) on delete restrict,
  airport_id uuid not null references public.airports(id) on delete restrict,
  status seat_status not null default 'available',
  manufacture_date date not null,
  purchase_date date not null,
  rental_cycles integer not null default 0,
  max_rental_cycles integer not null,
  last_cleaned_at timestamptz,
  last_inspected_at timestamptz,
  quarantine_reason text,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seats_rental_cycles_check check (rental_cycles >= 0),
  constraint seats_max_rental_cycles_check check (max_rental_cycles > 0)
);

create index seats_category_id_idx on public.seats(category_id);
create index seats_airport_id_idx on public.seats(airport_id);
create index seats_status_idx on public.seats(status);

create trigger set_seats_updated_at
  before update on public.seats
  for each row
  execute function set_updated_at();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists set_seats_updated_at on public.seats;
-- drop index if exists seats_status_idx;
-- drop index if exists seats_airport_id_idx;
-- drop index if exists seats_category_id_idx;
-- drop table if exists public.seats;
