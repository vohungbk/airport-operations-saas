-- CO-F08-S08: a booking can be cancelled in any step, and its seat is released.
--
-- Until now only pending and confirmed bookings could be cancelled. A booking at assigned
-- (seat reserved) or in_progress (seat in_use) was refused, so its seat could not be given back.
-- Now every step before completed can be cancelled:
--   pending | confirmed | assigned | in_progress -> cancelled   (admin and operations_manager, reason required)
-- completed, cancelled and no_show are still terminal; confirmed -> no_show is unchanged.
--
-- The seat is released in the same transaction as the cancellation: when the booking is at a step
-- that holds its seat (assigned: reserved, in_progress: in_use, read from booking_seat_rule()) and
-- the seat is still in that status, the seat goes back to available, with the booking number in the
-- seat status history. A booking without a seat, a step that holds no seat, or a seat that has since
-- gone to another status (for example quarantine) leaves the seat alone.
--
-- change_booking_status() becomes SECURITY DEFINER, like move_booking_to_next_step(): the seat
-- update goes through apply_booking_seat_status(), which clients cannot call. The caller check
-- (admin or operations_manager, else 42501) is made first, before anything is read or written.
-- Same signature, grants and error codes: 42501 not allowed, P0002 not found, 55000 invalid
-- transition, 22023 reason required. The step-order trigger is exempt for a definer function, so
-- the function checks the transition itself; the trigger list is kept the same for other writers.

create or replace function public.change_booking_status(
  p_booking_id uuid,
  p_to_status public.booking_status,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_seat public.seats;
  v_reason text := nullif(btrim(p_reason), '');
  v_held public.seat_status;
begin
  -- coalesce: the helper returns NULL (not false) for inactive/unknown callers.
  if not coalesce(public.is_admin_or_ops_manager(), false) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select *
    into v_booking
    from public.bookings b
   where b.id = p_booking_id
     for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if not (
    (v_booking.status = 'pending' and p_to_status in ('confirmed', 'cancelled'))
    or (v_booking.status = 'confirmed' and p_to_status in ('cancelled', 'no_show'))
    or (v_booking.status in ('assigned', 'in_progress') and p_to_status = 'cancelled')
  ) then
    raise exception 'Invalid booking status transition: % -> %', v_booking.status, p_to_status
      using errcode = '55000';
  end if;

  if p_to_status in ('cancelled', 'no_show') and v_reason is null then
    raise exception 'A reason is required to cancel a booking or mark it as no-show'
      using errcode = '22023';
  end if;

  -- The seat the cancelled booking still holds, locked after the booking (same order as the move).
  if p_to_status = 'cancelled' and v_booking.assigned_seat_id is not null then
    select r.seat_to
      into v_held
      from public.booking_seat_rule(v_booking.status) r;

    if found then
      -- Locks the seat only when it is still in the status the step holds; otherwise v_seat stays empty.
      select *
        into v_seat
        from public.seats s
       where s.id = v_booking.assigned_seat_id
         and s.status = v_held
         for update;
    end if;
  end if;

  perform set_config('app.booking_event_notes', coalesce(v_reason, ''), true);
  perform set_config('app.booking_change', 'on', true);

  update public.bookings b
     set status = p_to_status
   where b.id = p_booking_id
  returning b.* into v_booking;

  perform set_config('app.booking_event_notes', '', true);
  perform set_config('app.booking_change', '', true);

  if v_seat.id is not null then
    perform public.apply_booking_seat_status(
      v_seat.id,
      'available',
      'Booking ' || v_booking.booking_number || ' cancelled'
    );
  end if;

  return v_booking;
end;
$$;

create or replace function public.guard_booking_step_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  -- On the path: only to the next step.
  if public.booking_step_order(old.status) is not null
     and public.booking_step_order(new.status) = public.booking_step_order(old.status) + 1 then
    return new;
  end if;

  -- Leaving the path, as change_booking_status() allows. Keep this list the same as that
  -- function and as MANUAL_STATUS_TRANSITIONS in booking-status.ts.
  if (old.status in ('pending', 'assigned', 'in_progress') and new.status = 'cancelled')
     or (old.status = 'confirmed' and new.status in ('cancelled', 'no_show')) then
    return new;
  end if;

  raise exception 'Invalid booking step order: % -> %', old.status, new.status
    using errcode = '55000';
end;
$$;

-- Rollback (run manually against the target database if needed): restore change_booking_status()
-- from 20261002070738_booking_rpcs.sql and guard_booking_step_order() from
-- 20261119090000_booking_step_order.sql (both with create or replace). A seat already released by a
-- cancellation stays available.
