-- F02: incidents table. RLS deferred to F05.

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  seat_id uuid references public.seats(id) on delete set null,
  technician_job_id uuid references public.technician_jobs(id) on delete set null,
  type text not null,
  severity incident_severity not null,
  status incident_status not null default 'open',
  description text not null,
  reported_by uuid not null references public.users(id) on delete restrict,
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index incidents_partner_id_idx on public.incidents(partner_id);
create index incidents_status_idx on public.incidents(status);

create trigger set_incidents_updated_at
  before update on public.incidents
  for each row
  execute function set_updated_at();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists set_incidents_updated_at on public.incidents;
-- drop index if exists incidents_status_idx;
-- drop index if exists incidents_partner_id_idx;
-- drop table if exists public.incidents;
