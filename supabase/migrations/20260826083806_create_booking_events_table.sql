-- F02: booking_events table (immutable audit log). RLS deferred to F05.

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  seat_id uuid references public.seats(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  from_status booking_status,
  to_status booking_status not null,
  notes text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index booking_events_booking_id_idx on public.booking_events(booking_id);
create index booking_events_created_at_idx on public.booking_events(created_at);

-- Rollback (run manually against the target database if needed):
-- drop index if exists booking_events_created_at_idx;
-- drop index if exists booking_events_booking_id_idx;
-- drop table if exists public.booking_events;
