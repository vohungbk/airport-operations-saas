-- FO-F03-S01: record cleaning for a job.
--
-- cleaning_records had no link to a job, and its technician insert policy only
-- checked employee_id = auth.uid(): a technician could record cleaning for any
-- seat. This links a record to the job it was done for and tightens both
-- layers:
--   * cleaning_records.technician_job_id: the job the cleaning was recorded
--     for. Nullable: rows that predate it, and cleaning outside a job, have
--     none. A unique index allows one cleaning record per job.
--   * cleaning_records_insert_technician now also requires the job to be
--     assigned to the caller. Admin/ops keep their policy.
--   * guard_cleaning_insert (BEFORE INSERT, SECURITY DEFINER): when a job is
--     given, validates it and sets seat_id, booking_id, employee_id and
--     started_at itself, so a client can neither skip the checks nor forge
--     them. Rows without a job are not checked (the technician policy no
--     longer lets a technician insert one).
--
-- cleaning_records stays an immutable log by having no UPDATE/DELETE policy.
--
-- Error codes (same meaning as installations):
--   JB005  the job is not a cleaning job
--   JB006  the job is not active (assigned or in_progress)
--   JB007  the booking has no seat, or the seat is retired
--   22023  cleaning time is missing or in the future
--   23505  a cleaning is already recorded for this job

alter table public.cleaning_records
  add column technician_job_id uuid
    references public.technician_jobs(id) on delete restrict;

create unique index cleaning_records_technician_job_id_uidx
  on public.cleaning_records (technician_job_id);

create function public.guard_cleaning_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_type public.technician_job_type;
  v_job_status public.technician_job_status;
  v_booking_id uuid;
  v_seat_id uuid;
  v_seat_status public.seat_status;
begin
  if new.technician_job_id is null then
    return new;
  end if;

  select tj.job_type, tj.status, tj.booking_id, b.assigned_seat_id
    into v_job_type, v_job_status, v_booking_id, v_seat_id
    from public.technician_jobs tj
    join public.bookings b on b.id = tj.booking_id
   where tj.id = new.technician_job_id;

  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  if v_job_type is distinct from 'cleaning' then
    raise exception 'The job is not a cleaning job' using errcode = 'JB005';
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

  if v_seat_status = 'retired' then
    raise exception 'A retired seat cannot be cleaned' using errcode = 'JB007';
  end if;

  if new.completed_at is null then
    raise exception 'Cleaning time is required' using errcode = '22023';
  end if;

  -- A small allowance for clock skew between the browser and the server.
  if new.completed_at > now() + interval '5 minutes' then
    raise exception 'Cleaning time cannot be in the future'
      using errcode = '22023';
  end if;

  new.seat_id := v_seat_id;
  new.booking_id := v_booking_id;
  -- The form has one time, so the cleaning starts and ends at that time.
  new.started_at := new.completed_at;

  -- The caller is the one who recorded it. Without an app user (a trusted
  -- server insert) the given employee_id is kept.
  new.employee_id := coalesce(
    (select u.id from public.users u where u.id = auth.uid()),
    new.employee_id
  );

  return new;
end;
$$;

revoke execute on function public.guard_cleaning_insert() from public;
revoke execute on function public.guard_cleaning_insert() from anon;

create trigger guard_cleaning_records_insert
  before insert on public.cleaning_records
  for each row
  execute function public.guard_cleaning_insert();

-- A technician may record cleaning only for a job assigned to them.
drop policy "cleaning_records_insert_technician" on public.cleaning_records;

create policy "cleaning_records_insert_technician"
  on public.cleaning_records for insert
  to authenticated
  with check (
    employee_id = (select auth.uid())
    and exists (
      select 1
      from public.technician_jobs tj
      where tj.id = cleaning_records.technician_job_id
        and tj.technician_id = (select auth.uid())
    )
  );

-- Rollback (run manually against the target database if needed):
-- drop policy if exists "cleaning_records_insert_technician" on public.cleaning_records;
-- create policy "cleaning_records_insert_technician"
--   on public.cleaning_records for insert
--   to authenticated
--   with check (employee_id = (select auth.uid()));
-- drop trigger if exists guard_cleaning_records_insert on public.cleaning_records;
-- drop function if exists public.guard_cleaning_insert();
-- drop index if exists cleaning_records_technician_job_id_uidx;
-- alter table public.cleaning_records drop column if exists technician_job_id;
