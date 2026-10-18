-- FO-F03-S04: cleaning in two steps, reflected in the seat status.
--
-- Decisions (PRD open question 2):
--   * Start cleaning moves the seat available -> cleaning and creates the
--     cleaning record in the same transaction.
--   * Complete cleaning records the result. A passed cleaning returns the seat
--     to available; a failed cleaning, or an unresolved incident on the seat,
--     moves it to quarantine (there is no "maintenance" status) with a reason.
--   * Start is refused when the seat is not available or when another active
--     booking is in force now. The booking of the job itself is ignored: it
--     is the booking the seat was used for.
--
-- The seat status model stays the one in change_seat_status(): these
-- transitions are reached only through the two functions below, which signal
-- guard_seat_update() the same way and write seat_status_history through the
-- existing trigger. They are SECURITY DEFINER because technicians cannot
-- update seats; each one checks the caller itself (the assigned technician,
-- admin or operations manager). The update of the record on Complete is the
-- only change a cleaning record ever gets, and only these functions can make
-- it: UPDATE stays revoked from anon and authenticated.
--
-- Direct INSERT into cleaning_records still works until the screen moves to
-- these functions; a follow-up change revokes it then.
--
-- Error codes (in addition to the guard's JB005, JB006, JB007):
--   42501  the caller's role cannot record cleaning
--   P0002  job not found, or not the caller's (no existence leak)
--   JB005  not a cleaning job
--   JB006  the job is not active (assigned or in_progress)
--   JB007  the booking has no seat
--   JB008  the seat is not available for cleaning
--   JB009  another active booking is in force on the seat now
--   JB010  cleaning has not been started for this job
--   JB011  cleaning is already completed
--   JB012  the seat is no longer being cleaned
--   22023  result missing, or notes too long
--   23505  cleaning is already started for this job

-- -----------------------------------------------------------------------------
-- The direct-insert guard must not run for rows the start function creates.
-- The signal is transaction-local and set only inside start_cleaning().
-- -----------------------------------------------------------------------------
create or replace function public.guard_cleaning_insert()
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
  if coalesce(nullif(btrim(current_setting('app.cleaning_rpc', true)), ''), 'off') = 'on' then
    return new;
  end if;

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

-- -----------------------------------------------------------------------------
-- Internal: move a seat for the cleaning workflow, with the signals the seat
-- guard and the history trigger read. Not callable by clients.
-- -----------------------------------------------------------------------------
create function public.apply_cleaning_seat_status(
  p_seat_id uuid,
  p_to_status public.seat_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.seat_status_reason', coalesce(p_reason, ''), true);
  perform set_config('app.seat_status_change', 'on', true);

  update public.seats s
     set status = p_to_status,
         quarantine_reason = case
           when p_to_status = 'quarantine' then p_reason
           else null
         end
   where s.id = p_seat_id;

  perform set_config('app.seat_status_reason', '', true);
  perform set_config('app.seat_status_change', '', true);
end;
$$;

revoke execute on function public.apply_cleaning_seat_status(uuid, public.seat_status, text) from public;
revoke execute on function public.apply_cleaning_seat_status(uuid, public.seat_status, text) from anon;
revoke execute on function public.apply_cleaning_seat_status(uuid, public.seat_status, text) from authenticated;

-- -----------------------------------------------------------------------------
-- start_cleaning(): seat available -> cleaning, record created.
-- -----------------------------------------------------------------------------
create function public.start_cleaning(p_job_id uuid)
returns public.cleaning_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_job public.technician_jobs;
  v_booking public.bookings;
  v_seat public.seats;
  v_record public.cleaning_records;
begin
  select u.role
    into v_role
    from public.users u
   where u.id = v_uid
     and u.is_active;

  if v_role is null or v_role not in ('admin', 'operations_manager', 'technician') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  -- Locking the job serializes two starts for the same job.
  select *
    into v_job
    from public.technician_jobs tj
   where tj.id = p_job_id
     for update;

  if not found
     or (v_role = 'technician' and v_job.technician_id is distinct from v_uid) then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  if v_job.job_type is distinct from 'cleaning' then
    raise exception 'The job is not a cleaning job' using errcode = 'JB005';
  end if;

  if v_job.status not in ('assigned', 'in_progress') then
    raise exception 'The job is not active' using errcode = 'JB006';
  end if;

  if exists (
    select 1
      from public.cleaning_records c
     where c.technician_job_id = p_job_id
  ) then
    raise exception 'Cleaning is already started for this job'
      using errcode = '23505';
  end if;

  select * into v_booking from public.bookings b where b.id = v_job.booking_id;

  if v_booking.assigned_seat_id is null then
    raise exception 'The booking has no seat assigned' using errcode = 'JB007';
  end if;

  select *
    into v_seat
    from public.seats s
   where s.id = v_booking.assigned_seat_id
     for update;

  if v_seat.status is distinct from 'available' then
    raise exception 'The seat is not available for cleaning' using errcode = 'JB008';
  end if;

  if exists (
    select 1
      from public.bookings b
     where b.assigned_seat_id = v_seat.id
       and b.id <> v_booking.id
       and b.status in ('pending', 'confirmed', 'assigned', 'in_progress')
       and b.pickup_at <= now()
       and b.return_at > now()
  ) then
    raise exception 'Another booking is using the seat now' using errcode = 'JB009';
  end if;

  perform public.apply_cleaning_seat_status(v_seat.id, 'cleaning', 'Cleaning started');

  perform set_config('app.cleaning_rpc', 'on', true);

  insert into public.cleaning_records (
    technician_job_id, seat_id, booking_id, employee_id, started_at
  )
  values (
    p_job_id, v_seat.id, v_booking.id, v_uid, now()
  )
  returning * into v_record;

  perform set_config('app.cleaning_rpc', '', true);

  return v_record;
end;
$$;

revoke execute on function public.start_cleaning(uuid) from public;
revoke execute on function public.start_cleaning(uuid) from anon;
grant execute on function public.start_cleaning(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- complete_cleaning(): result recorded once; the seat leaves cleaning.
--   passed and no unresolved incident on the seat -> available
--   failed, or an unresolved incident             -> quarantine (reason set)
-- -----------------------------------------------------------------------------
create function public.complete_cleaning(
  p_job_id uuid,
  p_passed boolean,
  p_notes text default null
)
returns public.cleaning_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_job public.technician_jobs;
  v_record public.cleaning_records;
  v_seat public.seats;
  v_notes text := nullif(btrim(p_notes), '');
  v_to public.seat_status;
  v_reason text;
begin
  select u.role
    into v_role
    from public.users u
   where u.id = v_uid
     and u.is_active;

  if v_role is null or v_role not in ('admin', 'operations_manager', 'technician') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select *
    into v_job
    from public.technician_jobs tj
   where tj.id = p_job_id
     for update;

  if not found
     or (v_role = 'technician' and v_job.technician_id is distinct from v_uid) then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  if p_passed is null then
    raise exception 'A result is required' using errcode = '22023';
  end if;

  if char_length(coalesce(v_notes, '')) > 1000 then
    raise exception 'Notes are too long' using errcode = '22023';
  end if;

  if v_job.status not in ('assigned', 'in_progress') then
    raise exception 'The job is not active' using errcode = 'JB006';
  end if;

  select *
    into v_record
    from public.cleaning_records c
   where c.technician_job_id = p_job_id
     for update;

  if not found then
    raise exception 'Cleaning has not been started' using errcode = 'JB010';
  end if;

  if v_record.completed_at is not null then
    raise exception 'Cleaning is already completed' using errcode = 'JB011';
  end if;

  select *
    into v_seat
    from public.seats s
   where s.id = v_record.seat_id
     for update;

  if v_seat.status is distinct from 'cleaning' then
    raise exception 'The seat is no longer being cleaned' using errcode = 'JB012';
  end if;

  if not p_passed then
    v_to := 'quarantine';
    v_reason := 'Cleaning failed';
  elsif exists (
    select 1
      from public.incidents i
     where i.seat_id = v_seat.id
       and i.status in ('open', 'investigating')
  ) then
    v_to := 'quarantine';
    v_reason := 'Unresolved incident on the seat';
  else
    v_to := 'available';
    v_reason := 'Cleaning completed';
  end if;

  update public.cleaning_records c
     set completed_at = now(),
         passed = p_passed,
         notes = v_notes
   where c.id = v_record.id
  returning * into v_record;

  perform public.apply_cleaning_seat_status(v_seat.id, v_to, v_reason);

  return v_record;
end;
$$;

revoke execute on function public.complete_cleaning(uuid, boolean, text) from public;
revoke execute on function public.complete_cleaning(uuid, boolean, text) from anon;
grant execute on function public.complete_cleaning(uuid, boolean, text) to authenticated;

-- Rollback (run manually against the target database if needed). Restore the
-- previous guard_cleaning_insert() from 20261020090000_cleaning_record_guard.sql
-- after dropping the functions:
-- drop function if exists public.complete_cleaning(uuid, boolean, text);
-- drop function if exists public.start_cleaning(uuid);
-- drop function if exists public.apply_cleaning_seat_status(uuid, public.seat_status, text);
-- (then re-run the function body of guard_cleaning_insert from that migration)
