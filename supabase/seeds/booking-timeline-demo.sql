-- DEMO ONLY: one booking with a full history, to look at the Timeline tab of the Booking detail page
-- (UI-F06-T05). It is NOT in `[db.seed]`, so a reset does not load it. Load it by hand on a LOCAL database that
-- has the demo seed (`npm run demo:reset`):
--
--   npx supabase db query -f supabase/seeds/booking-timeline-demo.sql
--
-- Demo data is for a local database only (docs/database.md); do not load it on the linked project.
--
-- What BK-00132 shows in the Timeline tab (sign in as ops.manager@airportops.example or
-- admin@airportops.example), newest first:
--   Status:  Booking created, Status changed (confirmed, with a reason), Booking updated (vehicle, bay, notes),
--            Seat changed, Status changed (in progress, then completed).
--   Flight:  two "Flight updated" entries (the flight is delayed, then lands).
--   Money:   two "Adjustment added" entries (a refund and a chargeback).
-- The status events are written by the same database trigger the app uses, and the adjustments by the same
-- function (add_booking_adjustment), so they are real. The two flight updates are inserted directly, the way the
-- flight refresh job writes them.
--
-- Closing the rental and recording the adjustments depend on the revenue calculation. If the database refuses
-- them, the rest still loads and a NOTICE says what was left out (Money would then be empty): read the output.
-- Photos events are not recorded by the app yet (CO-F06), so that chip shows "No events of this type.".
--
-- It stops next to real data (an account whose address is not a demo or test address), and when the demo seed
-- (supabase/seeds/demo.sql) is not loaded. If BK-00132 already exists (the app can make it first), the file works on
-- that booking: it links the flight, moves it on step by step and records the adjustments. Loading it again adds only what is missing. History is never deleted. The event times are
-- the time of the load. Nothing here is real: every number, flight and booking is made up.

begin;

select set_config('app.booking_change', 'on', true);

do $seed$
declare
  c_dxb constant uuid := 'a0000000-0000-0000-0000-000000000001';
  c_dcr constant uuid := 'b0000000-0000-0000-0000-000000000001';
  c_category constant uuid := 'c0000000-0000-0000-0000-000000000004';
  c_ops constant uuid := 'a1000000-0000-0000-0000-000000000002';
  c_booking constant uuid := 'f0000000-0000-0000-0000-000000000132';
  v_id uuid;
  v_status public.booking_status;
  v_seat uuid;
  c_seat_a constant uuid := 'f2000000-0000-0000-0000-000000000132';
  c_seat_b constant uuid := 'f2000000-0000-0000-0000-000000000133';
  c_flight constant uuid := 'f1000000-0000-0000-0000-000000000132';
begin
  if exists (select 1 from public.users where email !~* '(\.example|@test\.local)$')
     or exists (select 1 from auth.users where email !~* '(\.example|@test\.local)$') then
    raise exception 'refusing to load: accounts with real addresses exist';
  end if;

  if not exists (select 1 from public.users where id = c_ops) then
    raise exception 'load supabase/seeds/demo.sql first (npm run demo:reset)';
  end if;

  -- BK-00132 may already exist (booking numbers come from a sequence, so the app can make it before this file
  -- runs). Work on that booking, whatever its id; only create it when there is none.
  select id, status, assigned_seat_id into v_id, v_status, v_seat from public.bookings where booking_number = 'BK-00132';

  perform set_config('request.jwt.claim.sub', c_ops::text, true);

  -- The flight of the booking: scheduled 16:30, then delayed 40 minutes, then landed.
  if not exists (select 1 from public.flights where id = c_flight) then
    insert into public.flights (
      id, flight_number, airport_id, scheduled_arrival_at, estimated_arrival_at, actual_arrival_at, status,
      terminal, delay_minutes, last_synced_at, provider
    )
    values (
      c_flight, 'EK301', c_dxb, timestamptz '2026-12-01 16:30:00+04', timestamptz '2026-12-01 17:10:00+04',
      timestamptz '2026-12-01 17:08:00+04', 'landed', 'Terminal 3', 40, clock_timestamp(), 'simulator'
    );

    insert into public.flight_updates (flight_id, source, changes, occurred_at)
    values
      (c_flight, 'provider',
       '[{"field":"status","from":"scheduled","to":"delayed"},
         {"field":"estimated_arrival_at","from":"2026-12-01T16:30:00+04:00","to":"2026-12-01T17:10:00+04:00"},
         {"field":"delay_minutes","from":null,"to":40}]'::jsonb,
       clock_timestamp() - interval '3 hours'),
      (c_flight, 'provider',
       '[{"field":"status","from":"delayed","to":"landed"},
         {"field":"actual_arrival_at","from":null,"to":"2026-12-01T17:08:00+04:00"}]'::jsonb,
       clock_timestamp() - interval '1 hour');
  end if;

  if v_id is null then
    v_id := c_booking;
    v_status := 'pending';
    v_seat := null;

    insert into public.seats (
      id, serial_number, manufacturer, model, category_id, airport_id,
      manufacture_date, purchase_date, max_rental_cycles
    )
    values
      (c_seat_a, 'TL-SEAT-0132', 'Demo Seats', 'Timeline Demo', c_category, c_dxb, date '2026-01-15', date '2026-01-20', 100)
    on conflict (id) do nothing;

    -- Created by operations ("Booking created").
    insert into public.bookings (
      id, booking_number, partner_id, airport_id, seat_category_id, flight_id, assigned_seat_id,
      external_booking_number, child_age_band, child_height, vehicle, vehicle_bay, notes, pickup_at, return_at,
      daily_rate
    )
    values (
      v_id, 'BK-00132', c_dcr, c_dxb, c_category, c_flight, c_seat_a,
      'ERC-DXB-48132', '24-48 months', 92.0, 'Toyota RAV4 · DXB A 48132', 'C-14', 'Parent asked for a rear-facing seat',
      timestamptz '2026-12-01 16:30:00+04', timestamptz '2026-12-08 16:30:00+04', 75.00
    );

    -- "Booking updated": vehicle, bay and notes.
    update public.bookings
       set vehicle = 'Nissan Patrol · DXB B 11204', vehicle_bay = 'C-15', notes = 'Install after landing'
     where id = v_id;
  else
    -- The flight of the booking.
    update public.bookings set flight_id = c_flight where id = v_id and flight_id is null;
  end if;

  -- "Status changed" to confirmed (with a reason) and then to in progress, from wherever the booking is.
  if v_status = 'pending' then
    perform set_config('app.booking_event_notes', 'Confirmed with the partner by phone', true);
    update public.bookings set status = 'confirmed' where id = v_id;
    perform set_config('app.booking_event_notes', '', true);
    v_status := 'confirmed';
  end if;

  -- "Seat changed": only for a booking that has no seat yet, or the one made here (never replaces a seat that
  -- somebody chose).
  if v_seat is null or v_id = c_booking then
    insert into public.seats (
      id, serial_number, manufacturer, model, category_id, airport_id,
      manufacture_date, purchase_date, max_rental_cycles
    )
    values
      (c_seat_a, 'TL-SEAT-0132', 'Demo Seats', 'Timeline Demo', c_category, c_dxb, date '2026-01-15', date '2026-01-20', 100),
      (c_seat_b, 'TL-SEAT-0133', 'Demo Seats', 'Timeline Demo', c_category, c_dxb, date '2026-01-15', date '2026-01-20', 100)
    on conflict (id) do nothing;

    if v_seat is null then
      update public.bookings set assigned_seat_id = c_seat_a where id = v_id;
    end if;
    update public.bookings set assigned_seat_id = c_seat_b where id = v_id;
  end if;

  if v_status = 'confirmed' then
    begin
      update public.bookings set status = 'in_progress' where id = v_id;
    exception when others then
      raise notice 'BK-00132: not moved to in progress (%)', sqlerrm;
    end;
  end if;

  -- "Status changed" to completed, then the money: a refund and a chargeback ("Adjustment added"). An adjustment
  -- needs a completed rental with revenue, so these steps are in one block that is skipped, with a notice, if the
  -- database refuses them.
  if not exists (select 1 from public.booking_adjustments where booking_id = v_id) then
    begin
      update public.bookings set status = 'completed' where id = v_id and status <> 'completed';
      perform public.add_booking_adjustment(v_id, 'partial_refund', 20.00, 'Early return refund');
      perform public.add_booking_adjustment(v_id, 'chargeback', 10.00, 'Service dispute');
    exception when others then
      raise notice 'BK-00132: the rental was not closed and no adjustment was recorded (%)', sqlerrm;
    end;
  end if;
end;
$seed$;

commit;
