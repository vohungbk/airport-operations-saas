-- DEMO ONLY: data to look at every part of the Command Centre (VI-F11-S01). It is NOT in `[db.seed]`, so a reset
-- does not load it. Load it by hand on a database that has the demo seed (`npm run demo:reset` for a local one).
-- On the linked project:
--
--   npx supabase db query --remote -f supabase/seeds/command-centre-demo.sql
--
-- On a local database:
--
--   npx supabase db query -f supabase/seeds/command-centre-demo.sql
--
-- The times are counted from the moment of the load (now), so the screen shows "today" whenever you load it.
-- Loading it twice does nothing. To move the times to a new "now", run `npm run demo:reset` and load it again.
--
-- What the Command Centre shows after the load (sign in as ops.manager@airportops.example or admin@airportops.example):
--   Arrivals today / Installations due   the six rentals below, whose pickup or flight is today at DXB
--   Overdue tasks                        2 (two installation jobs whose deadline passed 4 hours ago)
--   Banner, blue (early)                 EK 203, 45 minutes early, BK-CC001, the installation deadline moved earlier
--   Banner, amber (delayed)              EK 215, 50 minutes late, BK-CC002, the installation deadline moved
--   Banner, red (flag)                   QR 1007, cancelled, BK-CC003, to replan
--   Order of the banners                 early, then the flag, then the delay (AC03)
--
-- It stops next to real data (an account whose address is not a demo or test address), and when the demo seed
-- (supabase/seeds/demo.sql) is not loaded. To see the Empty state ("Nothing needs attention today.") reset with
-- `npm run demo:reset` and do not load this file: the demo seed has no rental, flight or job for today.
--
-- Nothing here is real: every number, flight and booking is made up.

begin;

select set_config('app.booking_change', 'on', true);

do $seed$
declare
  c_dxb constant uuid := 'a0000000-0000-0000-0000-000000000001';
  c_dcr constant uuid := 'b0000000-0000-0000-0000-000000000001';
  c_category constant uuid := 'c0000000-0000-0000-0000-000000000004';
  c_ops constant uuid := 'a1000000-0000-0000-0000-000000000002';
  c_tech1 constant uuid := 'd0000000-0000-0000-0000-000000000001';
  c_tech2 constant uuid := 'd0000000-0000-0000-0000-000000000002';
  c_tech3 constant uuid := 'd0000000-0000-0000-0000-000000000003';
  c_now constant timestamptz := date_trunc('minute', now());
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
  if exists (select 1 from public.bookings where booking_number = 'BK-CC001') then
    raise notice 'Command Centre demo data is already loaded; run npm run demo:reset to start again';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', c_ops::text, true);

  -- Flights. EK 203 lands 45 minutes before its schedule, EK 215 is 50 minutes late, QR 1007 is cancelled.
  insert into public.flights (
    id, flight_number, airport_id, scheduled_arrival_at, estimated_arrival_at, status, terminal, delay_minutes,
    last_synced_at, provider
  )
  values
    ('f1000000-0000-0000-0000-000000000001', 'EK203', c_dxb, c_now + interval '2 hours', c_now + interval '75 minutes',
     'scheduled', 'Terminal 3', null, c_now, 'simulator'),
    ('f1000000-0000-0000-0000-000000000002', 'EK215', c_dxb, c_now + interval '3 hours', c_now + interval '230 minutes',
     'delayed', 'Terminal 3', 50, c_now, 'simulator'),
    ('f1000000-0000-0000-0000-000000000003', 'QR1007', c_dxb, c_now + interval '5 hours', null,
     'cancelled', 'Terminal 1', null, c_now, 'simulator');

  -- Rentals. A pickup of today at DXB counts in Arrivals today; one with no installation record counts in
  -- Installations due. BK-CC001 to BK-CC003 are linked to a flight, BK-CC004 and BK-CC005 are overdue,
  -- BK-CC006 has no flight and no job.
  for v in
    select * from (
      values
        (1, 'f1000000-0000-0000-0000-000000000001', c_now + interval '2 hours'),
        (2, 'f1000000-0000-0000-0000-000000000002', c_now + interval '230 minutes'),
        (3, 'f1000000-0000-0000-0000-000000000003', c_now + interval '5 hours'),
        (4, null,                                   c_now - interval '3 hours'),
        (5, null,                                   c_now - interval '3 hours'),
        (6, null,                                   c_now + interval '4 hours')
    ) as t(n, flight_id, pickup_at)
    order by n
  loop
    insert into public.bookings (
      booking_number, partner_id, airport_id, seat_category_id, flight_id, pickup_at, return_at, daily_rate
    )
    values (
      'BK-CC' || lpad(v.n::text, 3, '0'), c_dcr, c_dxb, c_category, v.flight_id::uuid,
      v.pickup_at, v.pickup_at + interval '3 days', 75.00
    );

    update public.bookings set status = 'confirmed' where booking_number = 'BK-CC' || lpad(v.n::text, 3, '0');
  end loop;

  -- Installation jobs. The deadline is set by the system: one hour before the pickup, moved by the flight.
  -- BK-CC004 and BK-CC005 had a deadline 4 hours ago and are still open, so they are overdue.
  insert into public.technician_jobs (booking_id, technician_id, job_type, assigned_at, vehicle_bay)
  select b.id, j.technician_id, 'installation', c_now - interval '1 day', j.bay
    from (
      values
        ('BK-CC001', c_tech1, 'Bay 1'),
        ('BK-CC002', c_tech2, 'Bay 2'),
        ('BK-CC004', c_tech3, 'Bay 3'),
        ('BK-CC005', c_tech1, 'Bay 4')
    ) as j(booking_number, technician_id, bay)
    join public.bookings b on b.booking_number = j.booking_number;
end;
$seed$;

commit;
