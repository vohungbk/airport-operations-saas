-- F02: technician_jobs table. RLS deferred to F05.

create table public.technician_jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  technician_id uuid not null references public.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  vehicle_bay text,
  status technician_job_status not null default 'assigned',
  installation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index technician_jobs_technician_id_idx on public.technician_jobs(technician_id);
create index technician_jobs_status_idx on public.technician_jobs(status);
create index technician_jobs_booking_id_idx on public.technician_jobs(booking_id);

create trigger set_technician_jobs_updated_at
  before update on public.technician_jobs
  for each row
  execute function set_updated_at();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists set_technician_jobs_updated_at on public.technician_jobs;
-- drop index if exists technician_jobs_booking_id_idx;
-- drop index if exists technician_jobs_status_idx;
-- drop index if exists technician_jobs_technician_id_idx;
-- drop table if exists public.technician_jobs;
