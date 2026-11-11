-- DEMO ONLY: two inspection jobs, to try the Inspection tab of the job (states No inspection yet and Not
-- assigned). It is NOT in `[db.seed]`, so a reset does not load it. Load it by hand on a LOCAL database that
-- has the demo seed (`npm run demo:reset`):
--
--   npx supabase db query -f supabase/seeds/inspection-demo.sql
--
-- Demo data is for a local database only (docs/database.md); do not load it on the linked project.
--
-- Nothing here reads the clock: the bookings have fixed times, so every load is the same. Loading it twice does
-- nothing. To start again, run `npm run demo:reset` and load it again.
--
-- What it makes:
--   BK-IN001      SEAT-0032, no inspection recorded. An inspection job (Assigned) for technician1. Sign in as
--                 technician1@airportops.example, open the job, Inspection tab: "No inspection recorded yet"
--                 and the Record inspection button.
--   BK-IN002      SEAT-0033, one Pass inspection on 03 Nov 2026 16:40 GST. An inspection job (Assigned) for
--                 technician2. Sign in as admin@airportops.example or ops.manager@airportops.example, open
--                 the job, Inspection tab: "You are not assigned to this job" with the button off, and the
--                 last inspection line.
--
-- It stops next to real data (an account whose address is not a demo or test address), and when the demo seed
-- (supabase/seeds/demo.sql) is not loaded. Nothing here is real.

begin;

select set_config('app.booking_change', 'on', true);

do $seed$
declare
  c_dxb constant uuid := 'a0000000-0000-0000-0000-000000000001';
  c_dcr constant uuid := 'b0000000-0000-0000-0000-000000000001';
  c_cat_1 constant uuid := 'c0000000-0000-0000-0000-000000000001';
  c_cat_2 constant uuid := 'c0000000-0000-0000-0000-000000000002';
  c_seat_a constant uuid := 'e0000000-0000-0000-0000-000000000032';
  c_seat_b constant uuid := 'e0000000-0000-0000-0000-000000000033';
  c_booking_a constant uuid := 'f0000000-0000-0000-0000-000000000201';
  c_booking_b constant uuid := 'f0000000-0000-0000-0000-000000000202';
  c_job_a constant uuid := '10000000-0000-0000-0000-000000000201';
  c_job_b constant uuid := '10000000-0000-0000-0000-000000000202';
  c_record_b constant uuid := '13000000-0000-0000-0000-000000000201';
  c_ops constant uuid := 'a1000000-0000-0000-0000-000000000002';
  c_tech1 constant uuid := 'd0000000-0000-0000-0000-000000000001';
  c_tech2 constant uuid := 'd0000000-0000-0000-0000-000000000002';
begin
  if exists (select 1 from public.users where email !~* '(\.example|@test\.local)$')
     or exists (select 1 from auth.users where email !~* '(\.example|@test\.local)$') then
    raise exception 'refusing to load: accounts with real addresses exist';
  end if;

  if not exists (select 1 from public.users where id = c_ops) then
    raise exception 'load supabase/seeds/demo.sql first (npm run demo:reset)';
  end if;

  -- Already loaded: a rerun does nothing.
  if exists (select 1 from public.bookings where booking_number = 'BK-IN001') then
    raise notice 'Inspection demo data is already loaded; run npm run demo:reset to start again';
    return;
  end if;

  if (select count(*) from public.seats where id in (c_seat_a, c_seat_b) and status = 'available') <> 2 then
    raise exception 'SEAT-0032 or SEAT-0033 is not available; run npm run demo:reset and load this file again';
  end if;

  -- Operations make the bookings with the seats and confirm them, as the demo seed does.
  perform set_config('request.jwt.claim.sub', c_ops::text, true);

  insert into public.bookings (
    id, booking_number, partner_id, airport_id, seat_category_id, assigned_seat_id,
    pickup_at, return_at, daily_rate, notes
  )
  values
    (c_booking_a, 'BK-IN001', c_dcr, c_dxb, c_cat_1, c_seat_a,
     timestamptz '2026-12-21 09:00:00+04', timestamptz '2026-12-24 09:00:00+04', 75.00,
     'Demo: a seat that was never inspected'),
    (c_booking_b, 'BK-IN002', c_dcr, c_dxb, c_cat_2, c_seat_b,
     timestamptz '2026-12-21 10:00:00+04', timestamptz '2026-12-24 10:00:00+04', 75.00,
     'Demo: an inspection job of another technician');

  update public.bookings set status = 'confirmed' where id in (c_booking_a, c_booking_b);

  -- The inspection jobs: one for technician1, one for technician2. No inspection recorded for them yet.
  insert into public.technician_jobs (id, booking_id, technician_id, job_type, assigned_at)
  values
    (c_job_a, c_booking_a, c_tech1, 'inspection', timestamptz '2026-11-11 08:00:00+04'),
    (c_job_b, c_booking_b, c_tech2, 'inspection', timestamptz '2026-11-11 08:00:00+04');

  -- The earlier Pass inspection of SEAT-0033, with no job, so the guard keeps the values given here.
  insert into public.inspection_records (
    id, seat_id, booking_id, inspector_id, inspection_type, result, checklist, notes, created_at
  )
  values (
    c_record_b, c_seat_b, c_booking_b, c_tech1, 'general', 'pass',
    '{"harness_clip": "ok", "shell": "ok"}'::jsonb, 'Demo: the last inspection of this seat',
    timestamptz '2026-11-03 16:40:00+04'
  );
end;
$seed$;

commit;
