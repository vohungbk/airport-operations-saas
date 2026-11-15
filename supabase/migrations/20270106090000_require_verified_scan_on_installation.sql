-- FO-F07-S06: completing an installation needs a verified scan.
--
--   * the guard trigger now refuses an insert from a signed-in app caller (the JWT role is authenticated)
--     unless the job has a matched scan (installation_seat_scans.matched) of the booking's current seat;
--   * it raises JB013, which the app maps to "scan the seat first". A scan of an earlier seat does not
--     count after the booking's seat changed;
--   * trusted inserts without such a caller (seed data, a service-role job) are not blocked, as for the
--     photo, checklist and location rules.
--
-- The completion time and the actor (created_by) are already stored and never changed: the table has no
-- UPDATE or DELETE grant or policy (20261019090000), and one installation per job is a unique index.
-- Everything else in the guard function is unchanged.

create or replace function public.guard_installation_insert()
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
  select tj.job_type, tj.status, tj.booking_id, b.assigned_seat_id
    into v_job_type, v_job_status, v_booking_id, v_seat_id
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

  -- FO-F07-S06: an installation is completed only after the seat of the booking was scanned and matched.
  if auth.role() = 'authenticated'
     and not exists (
       select 1
         from public.installation_seat_scans s
        where s.technician_job_id = new.technician_job_id
          and s.assigned_seat_id = v_seat_id
          and s.matched
     ) then
    raise exception 'The seat must be scanned and verified first' using errcode = 'JB013';
  end if;

  -- A small allowance for clock skew between the browser and the server.
  if new.completed_at is not null
     and new.completed_at > now() + interval '5 minutes' then
    raise exception 'Installation time cannot be in the future'
      using errcode = '22023';
  end if;

  if auth.role() = 'authenticated'
     and not exists (
       select 1
         from public.booking_photos bp
        where bp.booking_id = v_booking_id
          and bp.type = 'installation'
     ) then
    raise exception 'A photo is required for this step' using errcode = 'JB010';
  end if;

  if auth.role() = 'authenticated'
     and (
       new.checklist is null
       or jsonb_typeof(new.checklist) <> 'array'
       or not (new.checklist ?& array[
         'category_and_fit',
         'shell_and_harness',
         'isofix_belt',
         'seat_movement',
         'harness_tension',
         'final_safety'
       ])
     ) then
    raise exception 'Every checklist item is required' using errcode = '22023';
  end if;

  if auth.role() = 'authenticated'
     and nullif(btrim(coalesce(new.vehicle_location, '')), '') is null then
    raise exception 'The vehicle location or bay is required' using errcode = '22023';
  end if;

  new.seat_id := v_seat_id;

  select u.id
    into new.created_by
    from public.users u
   where u.id = auth.uid();

  return new;
end;
$$;

-- Rollback (run manually against the target database if needed): re-run the guard_installation_insert body
-- from 20270105090000_installation_checklist_and_location.sql.
