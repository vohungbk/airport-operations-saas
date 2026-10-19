-- FO-F04-S01: record an inspection for a job.
--
-- inspection_records had no link to a job, and its technician insert policy
-- only checked inspector_id = auth.uid(): a technician could record an
-- inspection for any seat. This links a record to the job it was done for and
-- tightens both layers, the same way cleaning_records was handled:
--   * inspection_records.technician_job_id: the job the inspection was
--     recorded for. Nullable: rows that predate it, and inspections outside a
--     job, have none. A unique index allows one record per job.
--   * inspection_records_insert_technician now also requires the job to be
--     assigned to the caller. Admin/ops keep their policy.
--   * inspection_records_select_technician also lets a technician read the
--     record of a job assigned to them. Before, only the user who recorded it
--     could read it, so a record entered by admin/ops on a technician's job
--     was invisible to the technician and the screen offered the form again.
--   * guard_inspection_insert (BEFORE INSERT, SECURITY DEFINER): when a job is
--     given, validates it and sets seat_id, booking_id, inspector_id and
--     inspection_type itself, so a client can neither skip the checks nor
--     forge them. Rows without a job are not checked (the technician policy no
--     longer lets a technician insert one).
--
-- inspection_records stays an immutable log by having no UPDATE/DELETE policy.
--
-- Error codes (same meaning as installations and cleaning):
--   JB005  the job is not an inspection job
--   JB006  the job is not active (assigned or in_progress)
--   JB007  the booking has no seat, or the seat is retired
--   23505  an inspection is already recorded for this job

alter table public.inspection_records
  add column technician_job_id uuid
    references public.technician_jobs(id) on delete restrict;

create unique index inspection_records_technician_job_id_uidx
  on public.inspection_records (technician_job_id);

create function public.guard_inspection_insert()
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

  if v_job_type is distinct from 'inspection' then
    raise exception 'The job is not an inspection job' using errcode = 'JB005';
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
    raise exception 'A retired seat cannot be inspected' using errcode = 'JB007';
  end if;

  new.seat_id := v_seat_id;
  new.booking_id := v_booking_id;
  -- The form has no type; every inspection recorded for a job is a general one.
  new.inspection_type := 'general';

  -- The caller is the one who recorded it. Without an app user (a trusted
  -- server insert) the given inspector_id is kept.
  new.inspector_id := coalesce(
    (select u.id from public.users u where u.id = auth.uid()),
    new.inspector_id
  );

  return new;
end;
$$;

revoke execute on function public.guard_inspection_insert() from public;
revoke execute on function public.guard_inspection_insert() from anon;

create trigger guard_inspection_records_insert
  before insert on public.inspection_records
  for each row
  execute function public.guard_inspection_insert();

-- A technician may record an inspection only for a job assigned to them.
drop policy "inspection_records_insert_technician" on public.inspection_records;

create policy "inspection_records_insert_technician"
  on public.inspection_records for insert
  to authenticated
  with check (
    inspector_id = (select auth.uid())
    and exists (
      select 1
      from public.technician_jobs tj
      where tj.id = inspection_records.technician_job_id
        and tj.technician_id = (select auth.uid())
    )
  );

-- A technician reads their own records and the record of a job assigned to them.
drop policy "inspection_records_select_technician" on public.inspection_records;

create policy "inspection_records_select_technician"
  on public.inspection_records for select
  to authenticated
  using (
    inspector_id = (select auth.uid())
    or exists (
      select 1
      from public.technician_jobs tj
      where tj.id = inspection_records.technician_job_id
        and tj.technician_id = (select auth.uid())
    )
  );

-- Rollback (run manually against the target database if needed):
-- drop policy if exists "inspection_records_select_technician" on public.inspection_records;
-- create policy "inspection_records_select_technician"
--   on public.inspection_records for select
--   to authenticated
--   using (inspector_id = (select auth.uid()));
-- drop policy if exists "inspection_records_insert_technician" on public.inspection_records;
-- create policy "inspection_records_insert_technician"
--   on public.inspection_records for insert
--   to authenticated
--   with check (inspector_id = (select auth.uid()));
-- drop trigger if exists guard_inspection_records_insert on public.inspection_records;
-- drop function if exists public.guard_inspection_insert();
-- drop index if exists inspection_records_technician_job_id_uidx;
-- alter table public.inspection_records drop column if exists technician_job_id;
