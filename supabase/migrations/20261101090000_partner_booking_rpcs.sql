-- VI-F03-S03: a partner user creates and edits the bookings of their own
-- partner.
--
-- The only way in is these two functions. No INSERT or UPDATE policy is added
-- for partner users on public.bookings, so a direct write through the API is
-- still refused, and the booking guard triggers still hold. The functions are
-- SECURITY DEFINER on purpose: the availability check has to count the seats
-- and bookings of every partner, which RLS hides from a partner user. So each
-- function checks the caller and the scope itself:
--   * the caller must be an active partner_user with an active partner;
--   * the partner is always the caller's own (current_partner_user_partner_id),
--     never an argument;
--   * a booking of another partner is reported as not found, the same as a
--     booking that does not exist;
--   * the capacity check returns one number, never another partner's data.
-- A partner user does not choose a seat: operations assign it later.
--
-- Error codes (new: BK006):
--   42501  caller is not a partner user of an active partner
--   P0002  booking not found (or not the caller's partner's)
--   22023  invalid input (dates, rate, airport, category)
--   55000  only a pending booking can be edited
--   BK002  the seat already on the booking is taken for the new period
--   BK004  booking was changed by someone else (expected_updated_at mismatch)
--   BK006  no seat is free for the airport, category and period
-- Messages never name another partner's booking.

-- -----------------------------------------------------------------------------
-- The partner of the caller, only when the caller is an active partner_user and
-- the partner is active. NULL otherwise. Internal: not callable by clients.
-- -----------------------------------------------------------------------------
create function public.current_partner_user_partner_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select u.partner_id
    from public.users u
    join public.partners p on p.id = u.partner_id
   where u.id = auth.uid()
     and u.is_active
     and u.role = 'partner_user'
     and p.status = 'active'
   limit 1;
$$;

revoke execute on function public.current_partner_user_partner_id() from public;
revoke execute on function public.current_partner_user_partner_id() from anon;
revoke execute on function public.current_partner_user_partner_id() from authenticated;

-- -----------------------------------------------------------------------------
-- Seats still free for an airport, category and period: the seats that are
-- available, minus the active bookings of that airport and category that
-- overlap the period (assigned to a seat or not). Touching endpoints are not
-- an overlap. Internal: returns a number only.
-- -----------------------------------------------------------------------------
create function public.partner_booking_free_seats(
  p_airport_id uuid,
  p_seat_category_id uuid,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_exclude_booking_id uuid
)
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select (
    (select count(*)
       from public.seats s
      where s.airport_id = p_airport_id
        and s.category_id = p_seat_category_id
        and s.status = 'available')
    -
    (select count(*)
       from public.bookings b
      where b.airport_id = p_airport_id
        and b.seat_category_id = p_seat_category_id
        and b.id is distinct from p_exclude_booking_id
        and b.status in ('pending', 'confirmed', 'assigned', 'in_progress')
        and b.pickup_at < p_return_at
        and p_pickup_at < b.return_at)
  )::integer;
$$;

revoke execute on function public.partner_booking_free_seats(uuid, uuid, timestamptz, timestamptz, uuid) from public;
revoke execute on function public.partner_booking_free_seats(uuid, uuid, timestamptz, timestamptz, uuid) from anon;
revoke execute on function public.partner_booking_free_seats(uuid, uuid, timestamptz, timestamptz, uuid) from authenticated;

-- -----------------------------------------------------------------------------
-- create_partner_booking(): status is always 'pending'; booking_number is
-- generated; the partner is the caller's. Concurrent creates for one airport
-- and category are serialized with an advisory lock, so two of them cannot both
-- take the last free seat.
-- -----------------------------------------------------------------------------
create function public.create_partner_booking(
  p_airport_id uuid,
  p_seat_category_id uuid,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_daily_rate numeric,
  p_external_booking_number text default null,
  p_child_age_band text default null,
  p_child_height numeric default null,
  p_vehicle text default null,
  p_vehicle_bay text default null,
  p_notes text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner_id uuid := public.current_partner_user_partner_id();
  v_booking public.bookings;
begin
  if v_partner_id is null then
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

  if not exists (select 1 from public.airports a where a.id = p_airport_id) then
    raise exception 'Airport not found' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.seat_categories c where c.id = p_seat_category_id and c.is_active
  ) then
    raise exception 'Seat category must exist and be active' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('partner_booking:' || p_airport_id::text || ':' || p_seat_category_id::text, 0)
  );

  if public.partner_booking_free_seats(
       p_airport_id, p_seat_category_id, p_pickup_at, p_return_at, null
     ) <= 0 then
    raise exception 'No seat is available for this airport, category and period'
      using errcode = 'BK006';
  end if;

  perform set_config('app.booking_change', 'on', true);

  insert into public.bookings (
    booking_number, partner_id, airport_id, seat_category_id,
    pickup_at, return_at, daily_rate,
    external_booking_number, child_age_band, child_height,
    vehicle, vehicle_bay, notes, status
  )
  values (
    public.generate_booking_number(), v_partner_id, p_airport_id, p_seat_category_id,
    p_pickup_at, p_return_at, p_daily_rate,
    nullif(btrim(p_external_booking_number), ''), nullif(btrim(p_child_age_band), ''), p_child_height,
    nullif(btrim(p_vehicle), ''), nullif(btrim(p_vehicle_bay), ''), nullif(btrim(p_notes), ''), 'pending'
  )
  returning * into v_booking;

  perform set_config('app.booking_change', '', true);

  return v_booking;
end;
$$;

revoke execute on function public.create_partner_booking(uuid, uuid, timestamptz, timestamptz, numeric, text, text, numeric, text, text, text) from public;
revoke execute on function public.create_partner_booking(uuid, uuid, timestamptz, timestamptz, numeric, text, text, numeric, text, text, text) from anon;
grant execute on function public.create_partner_booking(uuid, uuid, timestamptz, timestamptz, numeric, text, text, numeric, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- update_partner_booking(): a pending booking of the caller's partner. Airport,
-- category, rate, status, number and seat are not arguments. When the schedule
-- changes the capacity is checked again without counting this booking, and a
-- seat that operations already assigned must still be free for the new period.
-- -----------------------------------------------------------------------------
create function public.update_partner_booking(
  p_booking_id uuid,
  p_expected_updated_at timestamptz,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_external_booking_number text default null,
  p_child_age_band text default null,
  p_child_height numeric default null,
  p_vehicle text default null,
  p_vehicle_bay text default null,
  p_notes text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner_id uuid := public.current_partner_user_partner_id();
  v_booking public.bookings;
begin
  if v_partner_id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select *
    into v_booking
    from public.bookings b
   where b.id = p_booking_id
     and b.partner_id = v_partner_id
     for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_booking.status <> 'pending' then
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

  if (p_pickup_at, p_return_at) is distinct from (v_booking.pickup_at, v_booking.return_at) then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'partner_booking:' || v_booking.airport_id::text || ':' || v_booking.seat_category_id::text, 0)
    );

    if public.partner_booking_free_seats(
         v_booking.airport_id, v_booking.seat_category_id,
         p_pickup_at, p_return_at, v_booking.id
       ) <= 0 then
      raise exception 'No seat is available for this airport, category and period'
        using errcode = 'BK006';
    end if;

    if v_booking.assigned_seat_id is not null and exists (
      select 1
        from public.bookings o
       where o.assigned_seat_id = v_booking.assigned_seat_id
         and o.id <> v_booking.id
         and o.status in ('pending', 'confirmed', 'assigned', 'in_progress')
         and o.pickup_at < p_return_at
         and p_pickup_at < o.return_at
    ) then
      raise exception 'The assigned seat is already booked for an overlapping period'
        using errcode = 'BK002';
    end if;
  end if;

  perform set_config('app.booking_change', 'on', true);

  update public.bookings b
     set pickup_at = p_pickup_at,
         return_at = p_return_at,
         external_booking_number = nullif(btrim(p_external_booking_number), ''),
         child_age_band = nullif(btrim(p_child_age_band), ''),
         child_height = p_child_height,
         vehicle = nullif(btrim(p_vehicle), ''),
         vehicle_bay = nullif(btrim(p_vehicle_bay), ''),
         notes = nullif(btrim(p_notes), '')
   where b.id = p_booking_id
  returning b.* into v_booking;

  perform set_config('app.booking_change', '', true);

  return v_booking;
end;
$$;

revoke execute on function public.update_partner_booking(uuid, timestamptz, timestamptz, timestamptz, text, text, numeric, text, text, text) from public;
revoke execute on function public.update_partner_booking(uuid, timestamptz, timestamptz, timestamptz, text, text, numeric, text, text, text) from anon;
grant execute on function public.update_partner_booking(uuid, timestamptz, timestamptz, timestamptz, text, text, numeric, text, text, text) to authenticated;

-- Rollback (run manually against the target database if needed):
-- drop function if exists public.update_partner_booking(uuid, timestamptz, timestamptz, timestamptz, text, text, numeric, text, text, text);
-- drop function if exists public.create_partner_booking(uuid, uuid, timestamptz, timestamptz, numeric, text, text, numeric, text, text, text);
-- drop function if exists public.partner_booking_free_seats(uuid, uuid, timestamptz, timestamptz, uuid);
-- drop function if exists public.current_partner_user_partner_id();
