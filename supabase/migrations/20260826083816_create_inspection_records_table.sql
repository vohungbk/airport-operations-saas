-- F02: inspection_records table. RLS deferred to F05.
-- inspection_type is free text, not one of the 11 named enums.

create table public.inspection_records (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.seats(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  inspector_id uuid not null references public.users(id) on delete restrict,
  inspection_type text not null,
  result inspection_result not null,
  checklist jsonb,
  notes text,
  photo_path text,
  created_at timestamptz not null default now()
);

-- Rollback (run manually against the target database if needed):
-- drop table if exists public.inspection_records;
