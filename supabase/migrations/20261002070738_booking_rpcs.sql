-- F11: booking RPCs. The only supported way to create, edit and change the
-- status of a booking (the guard trigger in 20261002070734 blocks direct
-- PATCHes of the protected columns).
--
-- All functions are SECURITY INVOKER, so bookings/seats RLS still applies on
-- top of the explicit admin/ops check at the top of each function. Execute is
-- revoked from public/anon and granted to authenticated. No service-role use.
--
-- Error codes:
--   42501  caller is not admin/operations_manager
--   P0002  booking not found
--   BK005  referenced seat not found
--   22023  invalid input (inactive partner/category, unknown airport, bad
--          dates or rate, missing reason)
--   55000  invalid state (terminal booking cannot be edited, invalid status
--          transition)
--   BK001  seat is not available (status <> 'available')
--   BK002  seat is already booked for an overlapping period
--   BK003  seat category or airport does not match the booking
--   BK004  booking was changed by someone else (expected_updated_at mismatch)
-- Messages never name another partner's booking.
--
-- Overlap rule: active bookings (pending, confirmed, assigned, in_progress)
-- on the same seat conflict when pickup_at < other.return_at and
-- other.pickup_at < return_at. Touching endpoints (A.return_at = B.pickup_at)
-- are NOT a conflict. Assigning a seat does not change seats.status.

-- -----------------------------------------------------------------------------
-- Seat assignability check shared by create_booking and update_booking.
-- Locks the seat row (FOR UPDATE) so concurrent assignments of one seat are
-- serialized; the loser re-reads committed bookings and gets BK002.
-- -----------------------------------------------------------------------------
create function public.assert_booking_seat_assignable(
  p_seat_id uuid,
  p_airport_id uuid,
  p_seat_category_id uuid,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_exclude_booking_id uuid,
  p_check_status boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_seat public.seats;
begin
  select *
    into v_seat
    from public.seats s
   where s.id = p_seat_id
     for update;

  if not found then
    raise exception 'Seat not found' using errcode = 'BK005';
  end if;

  if v_seat.airport_id <> p_airport_id or v_seat.category_id <> p_seat_category_id then
    raise exception 'Seat does not match the booking airport or seat category'
      using errcode = 'BK003';
  end if;

  if p_check_status and v_seat.status <> 'available' then
    raise exception 'Seat is not available' using errcode = 'BK001';
  end if;

  if exists (
    select 1
      from public.bookings b
     where b.assigned_seat_id = p_seat_id
       and b.id is distinct from p_exclude_booking_id
       and b.status in ('pending', 'confirmed', 'assigned', 'in_progress')
       and b.pickup_at < p_return_at
       and p_pickup_at < b.return_at
  ) then
    raise exception 'Seat is already booked for an overlapping period'
      using errcode = 'BK002';
  end if;
end;
$$;

revoke execute on function public.assert_booking_seat_assignable(uuid, uuid, uuid, timestamptz, timestamptz, uuid, boolean) from public;
revoke execute on function public.assert_booking_seat_assignable(uuid, uuid, uuid, timestamptz, timestamptz, uuid, boolean) from anon;
grant execute on function public.assert_booking_seat_assignable(uuid, uuid, uuid, timestamptz, timestamptz, uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- get_available_seats(): seats a booking could use for this airport, category
-- and period (same conditions as the assertion above). Read-only; for the
-- seat picker. p_exclude_booking_id keeps the booking's own seat selectable
-- while editing.
-- -----------------------------------------------------------------------------
create function public.get_available_seats(
  p_airport_id uuid,
  p_seat_category_id uuid,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_exclude_booking_id uuid default null
)
returns table (id uuid, serial_number text)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.serial_number
    from public.seats s
   where public.is_admin_or_ops_manager()
     and s.airport_id = p_airport_id
     and s.category_id = p_seat_category_id
     and s.status = 'available'
     and not exists (
       select 1
         from public.bookings b
        where b.assigned_seat_id = s.id
          and b.id is distinct from p_exclude_booking_id
          and b.status in ('pending', 'confirmed', 'assigned', 'in_progress')
          and b.pickup_at < p_return_at
          and p_pickup_at < b.return_at
     )
   order by s.serial_number;
$$;

revoke execute on function public.get_available_seats(uuid, uuid, timestamptz, timestamptz, uuid) from public;
revoke execute on function public.get_available_seats(uuid, uuid, timestamptz, timestamptz, uuid) from anon;
grant execute on function public.get_available_seats(uuid, uuid, timestamptz, timestamptz, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- create_booking(): status is always 'pending'; booking_number is generated.
-- The seat is optional. daily_rate is entered manually here and is read-only
-- afterwards (update_booking has no rate argument).
-- -----------------------------------------------------------------------------
create function public.create_booking(
  p_partner_id uuid,
  p_airport_id uuid,
  p_seat_category_id uuid,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_daily_rate numeric,
  p_assigned_seat_id uuid default null,
  p_external_booking_number text default null,
  p_child_age_band text default null,
  p_child_height numeric default null,
  p_vehicle text default null,
  p_vehicle_bay text default null,
  p_notes text default null
)
returns public.bookings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  -- coalesce: the helper returns NULL (not false) for inactive/unknown callers.
  if not coalesce(public.is_admin_or_ops_manager(), false) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_pickup_at is null or p_return_at is null then
    raise exception 'Pickup and return times are required' using errcode = '22023';
  end if;

  if p_return_at < p_pickup_at then
    raise exception 'Return time cannot be before pickup time' using errcode = '22023';
  end if;

  if p_daily_rate is null or p_daily_rate < 0 then
    raise exception 'Daily rate must be zero or more' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.partners p where p.id = p_partner_id and p.status = 'active'
  ) then
    raise exception 'Partner must exist and be active' using errcode = '22023';
  end if;

  if not exists (select 1 from public.airports a where a.id = p_airport_id) then
    raise exception 'Airport not found' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.seat_categories c where c.id = p_seat_category_id and c.is_active
  ) then
    raise exception 'Seat category must exist and be active' using errcode = '22023';
  end if;

  if p_assigned_seat_id is not null then
    perform public.assert_booking_seat_assignable(
      p_assigned_seat_id, p_airport_id, p_seat_category_id,
      p_pickup_at, p_return_at, null, true
    );
  end if;

  perform set_config('app.booking_change', 'on', true);

  insert into public.bookings (
    booking_number, partner_id, airport_id, seat_category_id,
    pickup_at, return_at, daily_rate, assigned_seat_id,
    external_booking_number, child_age_band, child_height,
    vehicle, vehicle_bay, notes, status
  )
  values (
    public.generate_booking_number(), p_partner_id, p_airport_id, p_seat_category_id,
    p_pickup_at, p_return_at, p_daily_rate, p_assigned_seat_id,
    nullif(btrim(p_external_booking_number), ''), nullif(btrim(p_child_age_band), ''), p_child_height,
    nullif(btrim(p_vehicle), ''), nullif(btrim(p_vehicle_bay), ''), nullif(btrim(p_notes), ''), 'pending'
  )
  returning * into v_booking;

  perform set_config('app.booking_change', '', true);

  return v_booking;
end;
$$;

revoke execute on function public.create_booking(uuid, uuid, uuid, timestamptz, timestamptz, numeric, uuid, text, text, numeric, text, text, text) from public;
revoke execute on function public.create_booking(uuid, uuid, uuid, timestamptz, timestamptz, numeric, uuid, text, text, numeric, text, text, text) from anon;
grant execute on function public.create_booking(uuid, uuid, uuid, timestamptz, timestamptz, numeric, uuid, text, text, numeric, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- update_booking(): full replacement of the editable fields (a NULL seat
-- unassigns). Only pending/confirmed bookings are editable. Partner, airport,
-- category, status, daily_rate and booking_number are not arguments.
-- p_expected_updated_at must equal the row's updated_at (lost-update guard).
-- -----------------------------------------------------------------------------
create function public.update_booking(
  p_booking_id uuid,
  p_expected_updated_at timestamptz,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_assigned_seat_id uuid default null,
  p_external_booking_number text default null,
  p_child_age_band text default null,
  p_child_height numeric default null,
  p_vehicle text default null,
  p_vehicle_bay text default null,
  p_notes text default null
)
returns public.bookings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.bookings;
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

  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'A % booking cannot be edited', v_booking.status using errcode = '55000';
  end if;

  if v_booking.updated_at is distinct from p_expected_updated_at then
    raise exception 'The booking was changed by someone else' using errcode = 'BK004';
  end if;

  if p_pickup_at is null or p_return_at is null then
    raise exception 'Pickup and return times are required' using errcode = '22023';
  end if;

  if p_return_at < p_pickup_at then
    raise exception 'Return time cannot be before pickup time' using errcode = '22023';
  end if;

  if p_assigned_seat_id is not null then
    perform public.assert_booking_seat_assignable(
      p_assigned_seat_id, v_booking.airport_id, v_booking.seat_category_id,
      p_pickup_at, p_return_at, v_booking.id,
      p_assigned_seat_id is distinct from v_booking.assigned_seat_id
    );
  end if;

  perform set_config('app.booking_change', 'on', true);

  update public.bookings b
     set pickup_at = p_pickup_at,
         return_at = p_return_at,
         assigned_seat_id = p_assigned_seat_id,
         external_booking_number = nullif(btrim(p_external_booking_number), ''),
         child_age_band = nullif(btrim(p_child_age_band), ''),
         child_height = p_child_height,
         vehicle = nullif(btrim(p_vehicle), ''),
         vehicle_bay = nullif(btrim(p_vehicle_bay), ''),
         notes = nullif(btrim(p_notes), '')
   where b.id = p_booking_id
  returning b.* into v_booking;

  if not found then
    -- RLS update policy hid the row even though select let us see it.
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  perform set_config('app.booking_change', '', true);

  return v_booking;
end;
$$;

revoke execute on function public.update_booking(uuid, timestamptz, timestamptz, timestamptz, uuid, text, text, numeric, text, text, text) from public;
revoke execute on function public.update_booking(uuid, timestamptz, timestamptz, timestamptz, uuid, text, text, numeric, text, text, text) from anon;
grant execute on function public.update_booking(uuid, timestamptz, timestamptz, timestamptz, uuid, text, text, numeric, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- change_booking_status(): manual transitions only.
--   pending   -> confirmed | cancelled
--   confirmed -> cancelled | no_show
-- assigned, in_progress and completed belong to later workflows; cancelled,
-- no_show and completed are terminal. A reason is required for cancelled and
-- no_show and is stored as the event notes.
-- -----------------------------------------------------------------------------
create function public.change_booking_status(
  p_booking_id uuid,
  p_to_status public.booking_status,
  p_reason text default null
)
returns public.bookings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_reason text := nullif(btrim(p_reason), '');
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
  ) then
    raise exception 'Invalid booking status transition: % -> %', v_booking.status, p_to_status
      using errcode = '55000';
  end if;

  if p_to_status in ('cancelled', 'no_show') and v_reason is null then
    raise exception 'A reason is required to cancel a booking or mark it as no-show'
      using errcode = '22023';
  end if;

  perform set_config('app.booking_event_notes', coalesce(v_reason, ''), true);
  perform set_config('app.booking_change', 'on', true);

  update public.bookings b
     set status = p_to_status
   where b.id = p_booking_id
  returning b.* into v_booking;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  perform set_config('app.booking_event_notes', '', true);
  perform set_config('app.booking_change', '', true);

  return v_booking;
end;
$$;

revoke execute on function public.change_booking_status(uuid, public.booking_status, text) from public;
revoke execute on function public.change_booking_status(uuid, public.booking_status, text) from anon;
grant execute on function public.change_booking_status(uuid, public.booking_status, text) to authenticated;

-- Rollback (run manually against the target database if needed):
-- drop function if exists public.change_booking_status(uuid, public.booking_status, text);
-- drop function if exists public.update_booking(uuid, timestamptz, timestamptz, timestamptz, uuid, text, text, numeric, text, text, text);
-- drop function if exists public.create_booking(uuid, uuid, uuid, timestamptz, timestamptz, numeric, uuid, text, text, numeric, text, text, text);
-- drop function if exists public.get_available_seats(uuid, uuid, timestamptz, timestamptz, uuid);
-- drop function if exists public.assert_booking_seat_assignable(uuid, uuid, uuid, timestamptz, timestamptz, uuid, boolean);
