-- FO-F05-S04: report an incident for a job.
--
-- The technician insert policy on incidents only checked that reported_by is
-- the caller and that, when a booking is given, partner_id matches it. A
-- technician could cite any job or seat, a deactivated technician could still
-- insert, and nothing stopped a client from sending status or resolved_*
-- values. This ties a report to a job and tightens both layers, the same way
-- inspection_records was handled:
--   * guard_incident_insert (BEFORE INSERT, SECURITY DEFINER): when a job is
--     given, it derives booking_id, seat_id and partner_id from the job, sets
--     type to the job type and reported_by to the caller, and forces status
--     open with no resolver. A client cannot forge any of them. A technician
--     who is not assigned to the job gets P0002, the same as for a job that
--     does not exist. Rows without a job (admin/ops or a trusted server
--     insert) are not changed.
--   * incidents_insert_technician now also requires an active technician, a
--     job, and that job assigned to the caller. Admin/ops keep their policy.
--
-- The booking status of the job is not checked: an incident can be reported on
-- a job that is already completed.
--
-- Error codes:
--   P0002  the job does not exist, or is not the technician's
--   42501  RLS: not an active technician, or a role that cannot report

create or replace function public.guard_incident_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_technician_id uuid;
  v_job_type public.technician_job_type;
  v_booking_id uuid;
  v_partner_id uuid;
  v_seat_id uuid;
begin
  if new.technician_job_id is null then
    return new;
  end if;

  select u.role
    into v_role
    from public.users u
   where u.id = v_uid
     and u.is_active;

  select tj.technician_id, tj.job_type, tj.booking_id, b.partner_id, b.assigned_seat_id
    into v_technician_id, v_job_type, v_booking_id, v_partner_id, v_seat_id
    from public.technician_jobs tj
    join public.bookings b on b.id = tj.booking_id
   where tj.id = new.technician_job_id;

  if not found
     or (v_role = 'technician' and v_technician_id is distinct from v_uid) then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  new.booking_id := v_booking_id;
  new.seat_id := v_seat_id;
  new.partner_id := v_partner_id;
  new.type := v_job_type::text;
  new.status := 'open';
  new.resolved_by := null;
  new.resolved_at := null;

  -- The caller is the one who reported it. Without an app user (a trusted
  -- server insert) the given reported_by is kept.
  new.reported_by := coalesce(
    (select u.id from public.users u where u.id = v_uid),
    new.reported_by
  );

  return new;
end;
$$;

revoke execute on function public.guard_incident_insert() from public;
revoke execute on function public.guard_incident_insert() from anon;

create trigger guard_incidents_insert
  before insert on public.incidents
  for each row
  execute function public.guard_incident_insert();

-- A technician may report only for a job assigned to them, while active.
drop policy "incidents_insert_technician" on public.incidents;

create policy "incidents_insert_technician"
  on public.incidents for insert
  to authenticated
  with check (
    (select public.current_user_role()) = 'technician'
    and reported_by = (select auth.uid())
    and technician_job_id is not null
    and exists (
      select 1
      from public.technician_jobs tj
      where tj.id = incidents.technician_job_id
        and tj.technician_id = (select auth.uid())
    )
    and (
      booking_id is null
      or partner_id = (select b.partner_id from public.bookings b where b.id = incidents.booking_id)
    )
  );

-- Rollback (run manually against the target database if needed):
-- drop policy if exists "incidents_insert_technician" on public.incidents;
-- create policy "incidents_insert_technician"
--   on public.incidents for insert
--   to authenticated
--   with check (
--     reported_by = (select auth.uid())
--     and (
--       booking_id is null
--       or partner_id = (select b.partner_id from public.bookings b where b.id = incidents.booking_id)
--     )
--   );
-- drop trigger if exists guard_incidents_insert on public.incidents;
-- drop function if exists public.guard_incident_insert();
