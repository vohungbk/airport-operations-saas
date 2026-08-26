-- F02: cleaning_records table. RLS deferred to F05.
-- booking_id is nullable: cleaning can occur outside a booking context.

create table public.cleaning_records (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.seats(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  employee_id uuid not null references public.users(id) on delete restrict,
  started_at timestamptz not null,
  completed_at timestamptz,
  checklist jsonb,
  passed boolean,
  notes text,
  photo_path text,
  created_at timestamptz not null default now()
);

-- Rollback (run manually against the target database if needed):
-- drop table if exists public.cleaning_records;
