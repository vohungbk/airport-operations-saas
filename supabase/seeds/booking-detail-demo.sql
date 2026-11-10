-- DEMO ONLY: data to look at every part of the Booking detail page (UI-F06-T03, UI-F06-T04). It is NOT in
-- `[db.seed]`, so a reset does not load it. Load it by hand on a LOCAL database that has the demo seed
-- (`npm run demo:reset`):
--
--   npx supabase db query -f supabase/seeds/booking-detail-demo.sql
--
-- Demo data is for a local database only (docs/database.md); do not load it on the linked project.
--
-- Nothing here reads the clock: the flights and rentals have fixed times, so every load is the same.
-- Loading it twice does nothing. To start again, run `npm run demo:reset` and load it again.
--
-- What the Booking detail page shows after the load (sign in as ops.manager@airportops.example or
-- admin@airportops.example; partner.dcr@airportops.example sees the same bookings as a partner user):
--   BK-BD001   Overview with the flight alert "ARRIVING 45 MINUTES EARLY" (EK 203), child, vehicle, bay, notes
--   BK-BD002   Overview with the flight alert "DELAYED 50 MINUTES" (EK 215)
--   BK-BD003   a cancelled booking: the Alert "Booking cancelled", read only
--   BK-00025   the Revenue tab of a completed rental with a refund, an adjustment and a chargeback
--              (BK-00026 has the one refund of the demo seed)
--
-- It stops next to real data (an account whose address is not a demo or test address), and when the demo seed
-- (supabase/seeds/demo.sql) is not loaded. Nothing here is real: every number, flight and booking is made up.

begin;

select set_config('app.booking_change', 'on', true);

do $seed$
declare
  c_dxb constant uuid := 'a0000000-0000-0000-0000-000000000001';
  c_dcr constant uuid := 'b0000000-0000-0000-0000-000000000001';
  c_category constant uuid := 'c0000000-0000-0000-0000-000000000004';
  c_ops constant uuid := 'a1000000-0000-0000-0000-000000000002';
  v record;
begin
  if exists (select 1 from public.users where email !~* '(\.example|@test\.local)$')
     or exists (select 1 from auth.users where email !~* '(\.example|@test\.local)$') then
    raise exception 'refusing to load: accounts with real addresses exist';
  end if;

  if not exists (select 1 from public.users where id = c_ops) then
    raise exception 'load supabase/seeds/demo.sql first (npm run demo:reset)';
  end if;

  -- Already loaded: the history of a booking cannot be deleted, so a rerun does nothing.
  if exists (select 1 from public.bookings where booking_number = 'BK-BD001') then
    raise notice 'Booking detail demo data is already loaded; run npm run demo:reset to start again';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', c_ops::text, true);

  -- Flights. EK 203 is expected 45 minutes before its schedule, EK 215 is 50 minutes late.
  insert into public.flights (
    id, flight_number, airport_id, scheduled_arrival_at, estimated_arrival_at, status, terminal, delay_minutes,
    last_synced_at, provider
  )
  values
    ('f1000000-0000-0000-0000-000000000011', 'EK203', c_dxb, timestamptz '2026-10-24 16:30:00+04',
     timestamptz '2026-10-24 15:45:00+04', 'scheduled', 'Terminal 3', null,
     timestamptz '2026-10-24 14:45:00+04', 'simulator'),
    ('f1000000-0000-0000-0000-000000000012', 'EK215', c_dxb, timestamptz '2026-10-24 17:00:00+04',
     timestamptz '2026-10-24 17:50:00+04', 'delayed', 'Terminal 3', 50,
     timestamptz '2026-10-24 14:45:00+04', 'simulator');

  -- Rentals with every field of the Overview filled: partner, external number, child, vehicle, bay, notes.
  for v in
    select * from (
      values
        (1, 'f1000000-0000-0000-0000-000000000011', 'ERC-DXB-48192', '24-48 months', 92.0, 'Toyota RAV4 · DXB A 48291', 'C-14', 'Parent asked for a rear-facing seat'),
        (2, 'f1000000-0000-0000-0000-000000000012', 'ERC-DXB-48193', '12-24 months', 80.0, 'Nissan Patrol · DXB B 11204', 'C-15', 'Flight is late: install after landing'),
        (3, null,                                   'ERC-DXB-48194', '4-8 years',     120.0, 'Kia Sportage · DXB C 90417', 'C-16', null)
    ) as t(n, flight_id, external_number, age_band, height, vehicle, bay, notes)
    order by n
  loop
    insert into public.bookings (
      booking_number, partner_id, airport_id, seat_category_id, flight_id, external_booking_number,
      child_age_band, child_height, vehicle, vehicle_bay, notes, pickup_at, return_at, daily_rate
    )
    values (
      'BK-BD' || lpad(v.n::text, 3, '0'), c_dcr, c_dxb, c_category, v.flight_id::uuid, v.external_number,
      v.age_band, v.height, v.vehicle, v.bay, v.notes,
      timestamptz '2026-10-24 16:30:00+04' + (v.n - 1) * interval '30 minutes',
      timestamptz '2026-11-01 16:30:00+04' + (v.n - 1) * interval '30 minutes', 75.00
    );
  end loop;

  -- BK-BD001 and BK-BD002 are confirmed by operations; BK-BD003 is cancelled with a reason.
  update public.bookings set status = 'confirmed' where booking_number in ('BK-BD001', 'BK-BD002');

  perform set_config('app.booking_event_notes', 'Customer changed their plans', true);
  update public.bookings set status = 'cancelled' where booking_number = 'BK-BD003';
  perform set_config('app.booking_event_notes', '', true);

  -- Revenue tab: BK-00025 is a completed rental of the demo seed with no adjustment. Three are recorded by
  -- operations through the same database function the app uses (VI-F04-S10): a refund, an adjustment and a chargeback.
  if exists (select 1 from public.bookings where id = 'f0000000-0000-0000-0000-000000000025' and status = 'completed') then
    perform public.add_booking_adjustment(
      'f0000000-0000-0000-0000-000000000025', 'partial_refund', 20.00, 'Early return refund');
    perform public.add_booking_adjustment(
      'f0000000-0000-0000-0000-000000000025', 'manual_adjustment', 10.00, 'Additional service credit');
    perform public.add_booking_adjustment(
      'f0000000-0000-0000-0000-000000000025', 'chargeback', 10.00, 'Service dispute');
  end if;
end;
$seed$;

commit;
