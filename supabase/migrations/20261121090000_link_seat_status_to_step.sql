-- CO-F08-S04: the seat status follows the booking step, from one rule in one place.
--
-- booking_seat_rule(step) says, for a step of the path, the status the seat has to be in before the
-- booking moves to it and the status the seat follows to:
--   assigned     available -> reserved
--   in_progress  reserved  -> in_use
--   completed    in_use    -> available   (the seat is released; cleaning starts from it)
-- A step without a rule (pending, confirmed, off the path) returns no row and leaves the seat alone.
--
-- move_booking_to_next_step() (CO-F08-S03) reads the rule from here instead of its own CASE
-- expressions. Nothing else changes: same checks, same error codes (BK007, BK008, BK009 with the
-- seat status in DETAIL), same grants. The TypeScript copy of the rule (SEAT_FOLLOWS in
-- src/features/bookings/lib/booking-move.ts) is checked against this function by an integration test.

create function public.booking_seat_rule(p_status public.booking_status)
returns table (seat_from public.seat_status, seat_to public.seat_status)
language sql
immutable
set search_path = ''
as $$
  select r.seat_from, r.seat_to
    from (
      values
        ('assigned'::public.booking_status, 'available'::public.seat_status, 'reserved'::public.seat_status),
        ('in_progress'::public.booking_status, 'reserved'::public.seat_status, 'in_use'::public.seat_status),
        ('completed'::public.booking_status, 'in_use'::public.seat_status, 'available'::public.seat_status)
    ) as r (step, seat_from, seat_to)
   where r.step = p_status;
$$;

revoke execute on function public.booking_seat_rule(public.booking_status) from public;
revoke execute on function public.booking_seat_rule(public.booking_status) from anon;
grant execute on function public.booking_seat_rule(public.booking_status) to authenticated;

create or replace function public.move_booking_to_next_step(
  p_booking_id uuid,
  p_expected_status public.booking_status,
  p_note text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_seat public.seats;
  v_note text := nullif(btrim(p_note), '');
  v_user uuid := auth.uid();
  v_is_manager boolean := coalesce(public.is_admin_or_ops_manager(), false);
  v_is_technician boolean := coalesce(public.current_user_role() = 'technician', false);
  v_position integer;
  v_to public.booking_status;
  v_seat_from public.seat_status;
  v_seat_to public.seat_status;
begin
  if v_user is null or not (v_is_manager or v_is_technician) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select *
    into v_booking
    from public.bookings b
   where b.id = p_booking_id
     for update;

  if not found then
    if v_is_manager then
      raise exception 'Booking not found' using errcode = 'P0002';
    end if;
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if not v_is_manager and v_booking.assigned_technician_id is distinct from v_user then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_booking.status is distinct from p_expected_status then
    raise exception 'The booking was changed by someone else'
      using errcode = 'BK007', detail = v_booking.status::text;
  end if;

  v_position := public.booking_step_order(v_booking.status);

  v_to := (case v_position
    when 1 then 'confirmed'
    when 2 then 'assigned'
    when 3 then 'in_progress'
    when 4 then 'completed'
    else null
  end)::public.booking_status;

  if v_to is null then
    raise exception 'The booking has no next step: %', v_booking.status
      using errcode = '55000';
  end if;

  -- The field steps may be moved by the assigned technician; the others by managers only.
  if not v_is_manager and v_to not in ('in_progress', 'completed') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if length(v_note) > 500 then
    raise exception 'The note must be at most 500 characters' using errcode = '22023';
  end if;

  select r.seat_from, r.seat_to
    into v_seat_from, v_seat_to
    from public.booking_seat_rule(v_to) r;

  if found then
    if v_booking.assigned_seat_id is null then
      raise exception 'The booking has no seat' using errcode = 'BK008';
    end if;

    select *
      into v_seat
      from public.seats s
     where s.id = v_booking.assigned_seat_id
       for update;

    if v_seat.status is distinct from v_seat_from then
      raise exception 'The seat must be % before %', v_seat_from, v_to
        using errcode = 'BK009', detail = v_seat.status::text;
    end if;
  end if;

  perform set_config('app.booking_event_notes', coalesce(v_note, ''), true);
  perform set_config('app.booking_change', 'on', true);

  update public.bookings b
     set status = v_to
   where b.id = p_booking_id
  returning b.* into v_booking;

  perform set_config('app.booking_event_notes', '', true);
  perform set_config('app.booking_change', '', true);

  if v_seat_to is not null then
    perform public.apply_booking_seat_status(
      v_seat.id,
      v_seat_to,
      'Booking ' || v_booking.booking_number || ' moved to ' || v_to
    );
  end if;

  return v_booking;
end;
$$;

-- Rollback (run manually against the target database if needed): restore move_booking_to_next_step()
-- from 20261120090000_move_booking_to_next_step.sql, then
-- drop function if exists public.booking_seat_rule(public.booking_status);
