-- FO-F02-S01: record an installation for a job.
--
-- RLS already limits who may insert (the assigned technician, admin/ops).
-- It cannot judge the values, so this adds:
--   * installations.seat_id: the seat the installation was recorded for
--     (copied from the booking at insert time, so it survives a later seat
--     change on the booking). Nullable for rows that predate it.
--   * a unique index: one installation per job.
--   * guard_installation_insert (BEFORE INSERT, SECURITY DEFINER): validates
--     the job and seat and sets seat_id/created_by itself, so a client can
--     neither skip the checks nor forge them.
--
-- installations stays an immutable log by having no UPDATE/DELETE policy.
--
-- Error codes:
--   JB005  the job is not an installation job
--   JB006  the job is not active (assigned or in_progress)
--   JB007  the booking has no seat, or the seat is in a status that does
--          not allow installation (allowed: available, reserved)
--   22023  installation time is in the future
--   23505  an installation is already recorded for this job

alter table public.installations
  add column seat_id uuid references public.seats(id) on delete restrict;

create unique index installations_technician_job_id_uidx
  on public.installations (technician_job_id);

create function public.guard_installation_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_type public.technician_job_type;
  v_job_status public.technician_job_status;
  v_seat_id uuid;
  v_seat_status public.seat_status;
begin
  select tj.job_type, tj.status, b.assigned_seat_id
    into v_job_type, v_job_status, v_seat_id
    from public.technician_jobs tj
    join public.bookings b on b.id = tj.booking_id
   where tj.id = new.technician_job_id;

  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  if v_job_type is distinct from 'installation' then
    raise exception 'The job is not an installation job' using errcode = 'JB005';
  end if;

  if v_job_status not in ('assigned', 'in_progress') then
    raise exception 'The job is not active' using errcode = 'JB006';
  end if;

  if v_seat_id is null then
    raise exception 'The booking has no seat assigned' using errcode = 'JB007';
  end if;

  select s.status
    into v_seat_status
    from public.seats s
   where s.id = v_seat_id;

  if v_seat_status not in ('available', 'reserved') then
    raise exception 'The seat is not in a status that allows installation'
      using errcode = 'JB007';
  end if;

  -- A small allowance for clock skew between the browser and the server.
  if new.completed_at is not null
     and new.completed_at > now() + interval '5 minutes' then
    raise exception 'Installation time cannot be in the future'
      using errcode = '22023';
  end if;

  new.seat_id := v_seat_id;

  select u.id
    into new.created_by
    from public.users u
   where u.id = auth.uid();

  return new;
end;
$$;

revoke execute on function public.guard_installation_insert() from public;
revoke execute on function public.guard_installation_insert() from anon;

create trigger guard_installations_insert
  before insert on public.installations
  for each row
  execute function public.guard_installation_insert();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists guard_installations_insert on public.installations;
-- drop function if exists public.guard_installation_insert();
-- drop index if exists installations_technician_job_id_uidx;
-- alter table public.installations drop column if exists seat_id;
