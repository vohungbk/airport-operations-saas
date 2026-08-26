-- F02: installations table. RLS deferred to F05.

create table public.installations (
  id uuid primary key default gen_random_uuid(),
  technician_job_id uuid not null references public.technician_jobs(id) on delete restrict,
  seat_verified boolean not null default false,
  category_verified boolean not null default false,
  installation_completed boolean not null default false,
  vehicle_location text,
  photo_path text,
  notes text,
  completed_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Rollback (run manually against the target database if needed):
-- drop table if exists public.installations;
