-- FO-F01-S04: job type on technician_jobs and an insert guard.
--
-- RLS (technician_jobs_insert_admin_ops_manager) already limits who may
-- create a job. It cannot validate the *values*, so the guard below blocks a
-- job for a technician who is inactive / not a technician, and for a booking
-- that is no longer active. A partial unique index blocks a second open job
-- of the same type on one booking (double submit).
--
-- Error codes:
--   JB001  technician is not an active user with the technician role
--   JB002  booking is not active (completed, cancelled or no_show)
--   23505  an open job of this type already exists for the booking

create type technician_job_type as enum (
  'installation',
  'cleaning',
  'inspection'
);

-- Existing rows predate job types and were all installation jobs.
alter table public.technician_jobs
  add column job_type technician_job_type not null default 'installation';

create unique index technician_jobs_open_booking_type_uidx
  on public.technician_jobs (booking_id, job_type)
  where status in ('assigned', 'in_progress');

-- SECURITY DEFINER so the check reads users/bookings regardless of the
-- caller's RLS, and a denied caller learns nothing from the error.
create function public.guard_technician_job_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.users u
     where u.id = new.technician_id
       and u.role = 'technician'
       and u.is_active
  ) then
    raise exception 'Technician is not active' using errcode = 'JB001';
  end if;

  if not exists (
    select 1
      from public.bookings b
     where b.id = new.booking_id
       and b.status in ('pending', 'confirmed', 'assigned', 'in_progress')
  ) then
    raise exception 'Booking is not active' using errcode = 'JB002';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_technician_job_insert() from public;
revoke execute on function public.guard_technician_job_insert() from anon;

create trigger guard_technician_jobs_insert
  before insert on public.technician_jobs
  for each row
  execute function public.guard_technician_job_insert();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists guard_technician_jobs_insert on public.technician_jobs;
-- drop function if exists public.guard_technician_job_insert();
-- drop index if exists technician_jobs_open_booking_type_uidx;
-- alter table public.technician_jobs drop column if exists job_type;
-- drop type if exists technician_job_type;
