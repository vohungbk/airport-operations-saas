-- FO-F03-S09: a cleaning cannot start while a booking holds or uses the seat in the
-- cleaning period (spec FO-F03 R10, E1).
--
-- Before, start_cleaning() refused only when another active booking was in force
-- at this moment (pickup_at <= now < return_at). A booking that starts in a few
-- minutes, and so already holds the seat, did not stop the start. Now the cleaning
-- has a period, from now for c_cleaning_period, and the start is refused when
-- another active booking overlaps it. The test is the one the booking functions use
-- to allocate a seat (assert_booking_seat_assignable): the same active statuses
-- (pending, confirmed, assigned, in_progress) and the same overlap of two periods,
-- so the two sides agree on what a clash is. The seat row is locked here and there,
-- so a booking and a cleaning cannot both get through at the same moment.
--
-- The length of the cleaning period is an assumption until the product owner decides
-- (spec FO-F03 Q6, ticket assumption FO-F03-S09-ASM01): there is no cleaning time in
-- the data, so it is one constant, c_cleaning_period, below. Change it there.
--
-- Unchanged: the signature, the grants, the error codes (JB009 stays the code of a
-- booking in the way), the booking of the job itself being ignored (it is the booking
-- the seat was used for), and the refusal changing nothing: every check comes before
-- the seat is moved or the record is created, and the function runs in one transaction.
-- The message does not name the other booking: a technician cannot read it.
--
-- Rollback: run the body of start_cleaning() from
-- 20261022090000_cleaning_start_complete.sql again.

create or replace function public.start_cleaning(p_job_id uuid)
returns public.cleaning_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- How long the cleaning is taken to last, for the test of a booking in the way.
  c_cleaning_period constant interval := interval '2 hours';
  v_now timestamptz := now();
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

  -- A booking that holds or uses the seat while it would be cleaned: it overlaps the
  -- period from now for c_cleaning_period. The booking of the job itself is the one
  -- the seat was used for, so it is not a clash.
  if exists (
    select 1
      from public.bookings b
     where b.assigned_seat_id = v_seat.id
       and b.id <> v_booking.id
       and b.status in ('pending', 'confirmed', 'assigned', 'in_progress')
       and b.pickup_at < v_now + c_cleaning_period
       and v_now < b.return_at
  ) then
    raise exception 'A booking holds or uses the seat in the cleaning period'
      using errcode = 'JB009';
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

-- create or replace keeps the grants of the function; stated again so the file is
-- complete on its own.
revoke execute on function public.start_cleaning(uuid) from public;
revoke execute on function public.start_cleaning(uuid) from anon;
grant execute on function public.start_cleaning(uuid) to authenticated;
