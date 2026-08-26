-- F02: bookings table. RLS deferred to F05.
-- child_age_band is free text, not an enum (plan.md open question 4).
-- gross_revenue/partner_share/platform_share are computed later by F22.

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null unique,
  partner_id uuid not null references public.partners(id) on delete restrict,
  airport_id uuid not null references public.airports(id) on delete restrict,
  external_booking_number text,
  pickup_at timestamptz not null,
  return_at timestamptz not null,
  flight_id uuid references public.flights(id) on delete set null,
  scheduled_arrival_at timestamptz,
  estimated_arrival_at timestamptz,
  actual_arrival_at timestamptz,
  seat_category_id uuid not null references public.seat_categories(id) on delete restrict,
  child_age_band text,
  child_height numeric(5,1),
  vehicle text,
  vehicle_bay text,
  assigned_seat_id uuid references public.seats(id) on delete set null,
  assigned_technician_id uuid references public.users(id) on delete set null,
  daily_rate numeric(12,2) not null,
  paid_days integer not null default 0,
  gross_revenue numeric(12,2),
  partner_share numeric(12,2),
  platform_share numeric(12,2),
  status booking_status not null default 'pending',
  incident_status incident_status,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_paid_days_check check (paid_days >= 0),
  constraint bookings_return_after_pickup_check check (return_at >= pickup_at)
);

create index bookings_partner_id_idx on public.bookings(partner_id);
create index bookings_status_idx on public.bookings(status);
create index bookings_pickup_at_idx on public.bookings(pickup_at);
create index bookings_return_at_idx on public.bookings(return_at);
create index bookings_assigned_seat_id_idx on public.bookings(assigned_seat_id);
create index bookings_assigned_technician_id_idx on public.bookings(assigned_technician_id);
create index bookings_flight_id_idx on public.bookings(flight_id);

create trigger set_bookings_updated_at
  before update on public.bookings
  for each row
  execute function set_updated_at();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists set_bookings_updated_at on public.bookings;
-- drop index if exists bookings_flight_id_idx;
-- drop index if exists bookings_assigned_technician_id_idx;
-- drop index if exists bookings_assigned_seat_id_idx;
-- drop index if exists bookings_return_at_idx;
-- drop index if exists bookings_pickup_at_idx;
-- drop index if exists bookings_status_idx;
-- drop index if exists bookings_partner_id_idx;
-- drop table if exists public.bookings;
