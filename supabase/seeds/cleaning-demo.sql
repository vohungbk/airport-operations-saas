-- DEMO ONLY: one cleaning job that has not been started, to try the Cleaning panel (UI-F06-T08). It is NOT in
-- `[db.seed]`, so a reset does not load it. Load it by hand on a LOCAL database that has the demo seed
-- (`npm run demo:reset`):
--
--   npx supabase db query -f supabase/seeds/cleaning-demo.sql
--
-- Demo data is for a local database only (docs/database.md); do not load it on the linked project.
--
-- Nothing here reads the clock: the booking has fixed times, so every load is the same. Loading it twice does
-- nothing. To start again, run `npm run demo:reset` and load it again.
--
-- What it makes:
--   BK-CL001      a confirmed booking of Demo Car Rental with SEAT-0031 (status Available), picked up on
--                 2026-12-20, so no other booking holds the seat when the cleaning starts
--   JOB-...       a cleaning job of this booking, status Assigned, for technician1@airportops.example
--
-- To try it, open the job from Jobs and choose Start cleaning on the Cleaning tab, signed in as
-- admin@airportops.example or ops.manager@airportops.example (the panel of the Admin and Operations Manager), or
-- as technician1@airportops.example (the technician screen).
--
-- It stops next to real data (an account whose address is not a demo or test address), and when the demo seed
-- (supabase/seeds/demo.sql) is not loaded. Nothing here is real.

begin;

select set_config('app.booking_change', 'on', true);

do $seed$
declare
  c_dxb constant uuid := 'a0000000-0000-0000-0000-000000000001';
  c_dcr constant uuid := 'b0000000-0000-0000-0000-000000000001';
  c_category constant uuid := 'c0000000-0000-0000-0000-000000000004';
  c_seat constant uuid := 'e0000000-0000-0000-0000-000000000031';
  c_booking constant uuid := 'f0000000-0000-0000-0000-000000000101';
  c_job constant uuid := '10000000-0000-0000-0000-000000000101';
  c_ops constant uuid := 'a1000000-0000-0000-0000-000000000002';
  c_tech1 constant uuid := 'd0000000-0000-0000-0000-000000000001';
begin
  if exists (select 1 from public.users where email !~* '(\.example|@test\.local)$')
     or exists (select 1 from auth.users where email !~* '(\.example|@test\.local)$') then
    raise exception 'refusing to load: accounts with real addresses exist';
  end if;

  if not exists (select 1 from public.users where id = c_ops) then
    raise exception 'load supabase/seeds/demo.sql first (npm run demo:reset)';
  end if;

  -- Already loaded: a rerun does nothing.
  if exists (select 1 from public.bookings where booking_number = 'BK-CL001') then
    raise notice 'Cleaning demo data is already loaded; run npm run demo:reset to start again';
    return;
  end if;

  if not exists (select 1 from public.seats where id = c_seat and status = 'available') then
    raise exception 'SEAT-0031 is not available; run npm run demo:reset and load this file again';
  end if;

  -- Operations make the booking with the seat and confirm it, as the demo seed does.
  perform set_config('request.jwt.claim.sub', c_ops::text, true);

  insert into public.bookings (
    id, booking_number, partner_id, airport_id, seat_category_id, assigned_seat_id,
    pickup_at, return_at, daily_rate, notes
  )
  values (
    c_booking, 'BK-CL001', c_dcr, c_dxb, c_category, c_seat,
    timestamptz '2026-12-20 09:00:00+04', timestamptz '2026-12-23 09:00:00+04', 75.00,
    'Demo: a seat that is ready to be cleaned'
  );

  update public.bookings set status = 'confirmed' where id = c_booking;

  -- The cleaning job, assigned to technician1. Not started: no cleaning record yet.
  insert into public.technician_jobs (id, booking_id, technician_id, job_type, assigned_at)
  values (c_job, c_booking, c_tech1, 'cleaning', timestamptz '2026-11-11 08:00:00+04');
end;
$seed$;

commit;
