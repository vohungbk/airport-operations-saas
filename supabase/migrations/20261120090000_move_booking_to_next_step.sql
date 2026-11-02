-- CO-F08-S03: move a booking to the next step, and the seat follows.
--
-- move_booking_to_next_step(booking, expected step, note) moves a booking one step along the
-- path (pending -> confirmed -> assigned -> in_progress -> completed, see
-- 20261119090000_booking_step_order.sql) and, in the same transaction, moves its seat:
--   -> assigned     seat available -> reserved
--   -> in_progress  seat reserved  -> in_use
--   -> completed    seat in_use    -> available   (cleaning starts from an available seat)
--   -> confirmed    the seat is not touched
-- A booking must have a seat for the steps after confirmed (BK008), and the seat must be in the
-- status the step comes from (BK009, with the seat status in DETAIL).
--
-- Who may move to a step:
--   admin and operations_manager: every step.
--   the technician assigned to the booking (bookings.assigned_technician_id): only the field
--   steps in_progress and completed.
--   anyone else (other technicians, partner users, signed out): 42501.
--
-- Two people moving the same booking at once: the row is locked (for update) and the caller says
-- which step it saw (p_expected_status). The first move wins; the second finds another step and
-- gets BK007, with the current step in DETAIL, and nothing is changed.
--
-- Error codes: 42501 not allowed (also for a booking a technician is not assigned to, so the
-- answer does not tell whether it exists), P0002 not found (managers only), 22023 note too long,
-- 55000 there is no next step, BK007 changed by someone else, BK008 no seat, BK009 seat not ready.
--
-- SECURITY DEFINER: a technician has no row-level security access to bookings or seats, so the
-- checks above are the access rule, made before anything is read or written. It runs as the
-- owner, so the step-order trigger (guard_bookings_step_order) does not apply to it and the
-- function follows booking_step_order() itself. search_path is empty; every name is qualified.

-- Internal: move a seat for the booking workflow, with the signals the seat guard and the history
-- trigger read. Not callable by clients.
create function public.apply_booking_seat_status(
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
     set status = p_to_status
   where s.id = p_seat_id;

  perform set_config('app.seat_status_reason', '', true);
  perform set_config('app.seat_status_change', '', true);
end;
$$;

revoke execute on function public.apply_booking_seat_status(uuid, public.seat_status, text) from public;
revoke execute on function public.apply_booking_seat_status(uuid, public.seat_status, text) from anon;
revoke execute on function public.apply_booking_seat_status(uuid, public.seat_status, text) from authenticated;

create function public.move_booking_to_next_step(
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

  if v_to in ('assigned', 'in_progress', 'completed') then
    if v_booking.assigned_seat_id is null then
      raise exception 'The booking has no seat' using errcode = 'BK008';
    end if;

    select *
      into v_seat
      from public.seats s
     where s.id = v_booking.assigned_seat_id
       for update;

    v_seat_from := (case v_to
      when 'assigned' then 'available'
      when 'in_progress' then 'reserved'
      else 'in_use'
    end)::public.seat_status;
    v_seat_to := (case v_to
      when 'assigned' then 'reserved'
      when 'in_progress' then 'in_use'
      else 'available'
    end)::public.seat_status;

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

revoke execute on function public.move_booking_to_next_step(uuid, public.booking_status, text) from public;
revoke execute on function public.move_booking_to_next_step(uuid, public.booking_status, text) from anon;
grant execute on function public.move_booking_to_next_step(uuid, public.booking_status, text) to authenticated;

-- Rollback (run manually against the target database if needed):
-- drop function if exists public.move_booking_to_next_step(uuid, public.booking_status, text);
-- drop function if exists public.apply_booking_seat_status(uuid, public.seat_status, text);
