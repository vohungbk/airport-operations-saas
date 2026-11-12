-- DEMO ONLY: four returned seats, to look at the Return queue and the Chain step screen (FO-F08-S01). It is NOT in
-- `[db.seed]`, so a reset does not load it. Load it by hand on a LOCAL database that has the demo seed
-- (`npm run demo:reset`):
--
--   npx supabase db query -f supabase/seeds/return-queue-demo.sql
--
-- Demo data is for a local database only (docs/database.md); do not load it on the linked project.
--
-- What it makes (Demo Car Rental, DXB), one booking per seat, moved step by step so the status events are the
-- ones the database trigger writes:
--   BK-RQ001  RQ-SEAT-0001  Returned                  seat Available
--   BK-RQ002  RQ-SEAT-0002  Cleaning                  seat Cleaning
--   BK-RQ003  RQ-SEAT-0003  Final inspection          seat Inspection
--   BK-RQ004  RQ-SEAT-0004  Final inspection failed   seat Quarantine
--
-- The events carry the time of the load, so the waiting time counts from the load. Open Return Queue signed in as
-- admin@airportops.example or ops.manager@airportops.example, then choose a seat to see its chain step.
--
-- It stops next to real data (an account whose address is not a demo or test address), and when the demo seed
-- (supabase/seeds/demo.sql) is not loaded. Loading it twice does nothing. Nothing here is real.

begin;

select set_config('app.booking_change', 'on', true);

do $seed$
declare
  c_dxb constant uuid := 'a0000000-0000-0000-0000-000000000001';
  c_dcr constant uuid := 'b0000000-0000-0000-0000-000000000001';
  c_category constant uuid := 'c0000000-0000-0000-0000-000000000004';
  c_ops constant uuid := 'a1000000-0000-0000-0000-000000000002';
  v_row record;
  v_step public.booking_status;
begin
  if exists (select 1 from public.users where email !~* '(\.example|@test\.local)$')
     or exists (select 1 from auth.users where email !~* '(\.example|@test\.local)$') then
    raise exception 'refusing to load: accounts with real addresses exist';
  end if;

  if not exists (select 1 from public.users where id = c_ops) then
    raise exception 'load supabase/seeds/demo.sql first (npm run demo:reset)';
  end if;

  -- Already loaded: a rerun does nothing.
  if exists (select 1 from public.bookings where booking_number = 'BK-RQ001') then
    raise notice 'Return queue demo data is already loaded; run npm run demo:reset to start again';
    return;
  end if;

  -- Operations make the bookings, as the demo seed does.
  perform set_config('request.jwt.claim.sub', c_ops::text, true);

  for v_row in
    select *
    from (values
      ('f3000000-0000-0000-0000-000000000001'::uuid, 'e3000000-0000-0000-0000-000000000001'::uuid,
       'BK-RQ001', 'RQ-SEAT-0001', 'available'::public.seat_status, 'returned'::public.booking_status),
      ('f3000000-0000-0000-0000-000000000002'::uuid, 'e3000000-0000-0000-0000-000000000002'::uuid,
       'BK-RQ002', 'RQ-SEAT-0002', 'cleaning'::public.seat_status, 'cleaning'::public.booking_status),
      ('f3000000-0000-0000-0000-000000000003'::uuid, 'e3000000-0000-0000-0000-000000000003'::uuid,
       'BK-RQ003', 'RQ-SEAT-0003', 'inspection'::public.seat_status, 'inspection'::public.booking_status),
      ('f3000000-0000-0000-0000-000000000004'::uuid, 'e3000000-0000-0000-0000-000000000004'::uuid,
       'BK-RQ004', 'RQ-SEAT-0004', 'quarantine'::public.seat_status, 'inspection'::public.booking_status)
    ) as t(booking_id, seat_id, booking_number, serial_number, seat_status, final_status)
  loop
    -- The seat gets the status of its step when it is made: a status change needs change_seat_status().
    insert into public.seats (
      id, serial_number, manufacturer, model, category_id, airport_id,
      manufacture_date, purchase_date, max_rental_cycles, status, quarantine_reason
    )
    values (
      v_row.seat_id, v_row.serial_number, 'Demo Seats', 'Return Queue Demo', c_category, c_dxb,
      date '2026-01-15', date '2026-01-20', 100, v_row.seat_status,
      case when v_row.seat_status = 'quarantine' then 'Demo: final inspection failed, harness buckle does not latch' end
    );

    insert into public.bookings (
      id, booking_number, partner_id, airport_id, seat_category_id, assigned_seat_id,
      pickup_at, return_at, daily_rate, notes
    )
    values (
      v_row.booking_id, v_row.booking_number, c_dcr, c_dxb, c_category, v_row.seat_id,
      timestamptz '2026-10-28 09:00:00+04', timestamptz '2026-11-03 09:00:00+04', 75.00,
      'Demo: a returned seat in the return chain'
    );

    -- Step by step to the step of the chain; each change writes its status event.
    foreach v_step in array array['confirmed', 'in_progress', 'returned', 'cleaning', 'inspection']::public.booking_status[]
    loop
      update public.bookings set status = v_step where id = v_row.booking_id;
      exit when v_step = v_row.final_status;
    end loop;
  end loop;
end;
$seed$;

commit;
