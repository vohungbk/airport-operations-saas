-- VI-F05-S01: demo data for the KPI dashboard, so that every state of the screen can be looked at.
--
-- It is NOT part of `npx supabase db reset` (it is not in [db.seed] of supabase/config.toml): load it by hand
-- after supabase/seed.sql and supabase/seeds/demo.sql, with
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seeds/kpi-demo.sql
--
-- It adds 31 rentals that are over (BK-00101 to BK-00131), each with its own seat, installation, records and
-- incidents, for the two demo partners, in September, October and November 2026.
--
--   * It is one statement, so it is all or nothing: if anything fails, nothing of it is kept.
--   * It refuses to run next to real data: if an account with an address that is not a demo or test address
--     exists, it stops. It also stops if supabase/seeds/demo.sql has not been loaded (it needs its accounts,
--     its technicians and the commercial terms of the two partners).
--   * Loading it again does nothing: a marker row (BK-00101) says it is loaded.
--   * It uses the same signals and the same actors as demo.sql, so the booking, job and incident histories are
--     real. System timestamps are the time of the load; it is not a deterministic seed.
--
-- What each period shows (every figure below is the rate of the rows of this file; the screen adds to them
-- the rentals of demo.sql, which is only two rentals in August, so nothing else is in these months):
--
--   Partner Demo Car Rental (partner.dcr@airportops.example)
--     September 2026   8 rentals   Correct-seat 6/8 = 75%        Family Ready on time 7/8 = 87.5%
--                                  Traceability 7/8 = 87.5%      Incidents 4
--     October 2026    10 rentals   Correct-seat 9/10 = 90%       Family Ready on time 8/10 = 80%
--                                  Traceability 10/10 = 100%     Incidents 2   (so October against September
--                                  shows: up 15 pp, down 7.5 pp, "No data gaps", down 2 incidents)
--     November 2026    4 rentals   Correct-seat 3/3 (1 left out) Family Ready on time 3/3 = 100%
--                                  Traceability 3/4 = 75%        Incidents 0
--     August 2026     (demo.sql)   Correct-seat Not available, Family Ready No data
--     July 2026        nothing     the Empty state
--   Partner Demo Mobility (partner.dmo@airportops.example)
--     September 2026   3 rentals   Family Ready No data (no rental reached Family Ready)
--     October 2026     4 rentals   Family Ready No data, Traceability 2/4 = 50%, Incidents 1
--     November 2026    2 rentals   Correct-seat Not available and Family Ready Not available (no installation
--                                  job, so no result and no deadline), Traceability 2/2
--   Admin and operations manager see both partners together.

do $kpi$
declare
  c_dcr constant uuid := 'b0000000-0000-0000-0000-000000000001';
  c_dmo constant uuid := 'b0000000-0000-0000-0000-000000000002';
  c_dxb constant uuid := 'a0000000-0000-0000-0000-000000000001';
  c_ops constant uuid := 'a1000000-0000-0000-0000-000000000002';
  c_tech1 constant uuid := 'd0000000-0000-0000-0000-000000000001';
  c_tech2 constant uuid := 'd0000000-0000-0000-0000-000000000002';
  c_tech3 constant uuid := 'd0000000-0000-0000-0000-000000000003';
  -- A seat of the base seed that is never the one of these rentals: the wrong seat of a failed scan.
  c_other_seat constant uuid := 'e0000000-0000-0000-0000-000000000040';
  v record;
  r record;
  v_booking uuid;
  v_seat uuid;
  v_job uuid;
  v_tech uuid;
  v_partner uuid;
  v_category uuid;
  v_pickup timestamptz;
  v_ret timestamptz;
  i integer;
  m text;
begin
  -- Not a demo or test database: real accounts exist.
  if exists (
    select 1 from public.users
     where email !~* '(\.example|@test\.local)$'
  ) or exists (
    select 1 from auth.users
     where email !~* '(\.example|@test\.local)$'
  ) then
    raise exception 'refusing to load demo data: accounts with real addresses exist';
  end if;

  -- The demo accounts, technicians and partner terms come from demo.sql.
  if not exists (select 1 from public.users where id = c_ops)
     or not exists (select 1 from public.partner_commercial_terms where partner_id in (c_dcr, c_dmo)) then
    raise exception 'load supabase/seeds/demo.sql first: this file needs its accounts and partner terms';
  end if;

  if exists (select 1 from public.bookings where id = 'f1000000-0000-0000-0000-000000000101') then
    raise notice 'KPI demo data is already loaded; nothing to do';
    return;
  end if;

  -- The signals the guard triggers read are on for the whole load and off at the end. The Family Ready
  -- moment is set by a trigger to the time of the change; the rentals are in the past, so it is off here
  -- and the moment is written by hand.
  perform set_config('app.booking_change', 'on', false);
  alter table public.bookings disable trigger set_bookings_family_ready;

  for v in
    select * from (
      values
        -- n, partner, return time, daily rate, seat scan (t = right seat, f = wrong seat, n = installed but no
        -- result stored, x = no installation job), Family Ready (on = before the deadline, late = after it,
        -- none = never reached it, nojob = reached it but there is no installation job, so no deadline),
        -- cleaning record, inspection record, incidents
        -- Demo Car Rental, September: 6/8 seat, 7/8 on time, 7/8 traced, 4 incidents
        (101, 'dcr', '2026-09-21 08:00:00+04', 80.00, 't', 'on',   true,  true,  1),
        (102, 'dcr', '2026-09-22 08:00:00+04', 75.00, 't', 'on',   true,  true,  1),
        (103, 'dcr', '2026-09-23 08:00:00+04', 90.00, 't', 'on',   true,  true,  0),
        (104, 'dcr', '2026-09-24 08:00:00+04', 70.00, 't', 'late', true,  true,  1),
        (105, 'dcr', '2026-09-25 08:00:00+04', 80.00, 't', 'on',   true,  true,  0),
        (106, 'dcr', '2026-09-26 08:00:00+04', 75.00, 't', 'on',   true,  true,  1),
        (107, 'dcr', '2026-09-27 08:00:00+04', 90.00, 'f', 'on',   true,  false, 0),
        (108, 'dcr', '2026-09-28 08:00:00+04', 70.00, 'f', 'on',   true,  true,  0),
        -- Demo Car Rental, October: 9/10 seat, 8/10 on time, 10/10 traced, 2 incidents
        (109, 'dcr', '2026-10-05 08:00:00+04', 80.00, 't', 'on',   true,  true,  0),
        (110, 'dcr', '2026-10-07 08:00:00+04', 75.00, 't', 'on',   true,  true,  0),
        (111, 'dcr', '2026-10-09 08:00:00+04', 90.00, 't', 'on',   true,  true,  1),
        (112, 'dcr', '2026-10-12 08:00:00+04', 70.00, 't', 'late', true,  true,  0),
        (113, 'dcr', '2026-10-14 08:00:00+04', 80.00, 't', 'on',   true,  true,  0),
        (114, 'dcr', '2026-10-16 08:00:00+04', 75.00, 't', 'on',   true,  true,  0),
        (115, 'dcr', '2026-10-19 08:00:00+04', 90.00, 't', 'late', true,  true,  0),
        (116, 'dcr', '2026-10-21 08:00:00+04', 70.00, 't', 'on',   true,  true,  1),
        (117, 'dcr', '2026-10-24 08:00:00+04', 80.00, 'f', 'on',   true,  true,  0),
        (118, 'dcr', '2026-10-27 08:00:00+04', 75.00, 't', 'on',   true,  true,  0),
        -- Demo Car Rental, November: 3/3 seat (one without a result), 3/3 on time, 3/4 traced, no incident
        (119, 'dcr', '2026-11-01 08:00:00+04', 80.00, 't', 'on',   true,  true,  0),
        (120, 'dcr', '2026-11-02 08:00:00+04', 75.00, 't', 'on',   true,  true,  0),
        (121, 'dcr', '2026-11-03 08:00:00+04', 90.00, 'n', 'on',   true,  false, 0),
        (122, 'dcr', '2026-11-05 08:00:00+04', 70.00, 't', 'none', true,  true,  0),
        -- Demo Mobility, September: no rental reached Family Ready
        (123, 'dmo', '2026-09-22 08:00:00+04', 85.00, 't', 'none', true,  true,  1),
        (124, 'dmo', '2026-09-24 08:00:00+04', 70.00, 'f', 'none', true,  true,  0),
        (125, 'dmo', '2026-09-26 08:00:00+04', 80.00, 't', 'none', true,  false, 0),
        -- Demo Mobility, October: 2/4 traced, 1 incident
        (126, 'dmo', '2026-10-06 08:00:00+04', 85.00, 't', 'none', true,  true,  0),
        (127, 'dmo', '2026-10-12 08:00:00+04', 70.00, 't', 'none', true,  true,  0),
        (128, 'dmo', '2026-10-18 08:00:00+04', 80.00, 't', 'none', true,  false, 1),
        (129, 'dmo', '2026-10-25 08:00:00+04', 90.00, 't', 'none', false, false, 0),
        -- Demo Mobility, November: no installation job, so no seat result and no deadline
        (130, 'dmo', '2026-11-02 08:00:00+04', 85.00, 'x', 'nojob', true, true,  0),
        (131, 'dmo', '2026-11-04 08:00:00+04', 70.00, 'x', 'nojob', true, true,  0)
    ) as t(n, partner, ret, rate, scan, fr, cleaned, inspected, incident_count)
    order by n
  loop
    v_booking := ('f1000000-0000-0000-0000-' || lpad(v.n::text, 12, '0'))::uuid;
    v_seat := ('e2000000-0000-0000-0000-' || lpad(v.n::text, 12, '0'))::uuid;
    v_job := ('10100000-0000-0000-0000-' || lpad(v.n::text, 12, '0'))::uuid;
    v_tech := (array[c_tech1, c_tech2, c_tech3])[(v.n % 3) + 1];
    v_partner := case when v.partner = 'dcr' then c_dcr else c_dmo end;
    v_category := (array[
      'c0000000-0000-0000-0000-000000000001',
      'c0000000-0000-0000-0000-000000000002',
      'c0000000-0000-0000-0000-000000000003',
      'c0000000-0000-0000-0000-000000000004'
    ]::uuid[])[(v.n % 4) + 1];
    v_ret := v.ret::timestamptz;
    v_pickup := v_ret - interval '3 days';

    -- Its own seat, so no two rentals share one.
    insert into public.seats (
      id, serial_number, manufacturer, model, category_id, airport_id,
      manufacture_date, purchase_date, max_rental_cycles
    )
    values (
      v_seat, 'KPI-SEAT-' || lpad(v.n::text, 4, '0'), 'Demo Seats', 'KPI Demo', v_category, c_dxb,
      date '2026-01-15', date '2026-01-20', 100
    );

    -- Operations make the booking, then confirm it; the technician starts the rental.
    perform set_config('request.jwt.claim.sub', c_ops::text, false);
    insert into public.bookings (
      id, booking_number, partner_id, airport_id, seat_category_id, assigned_seat_id,
      pickup_at, return_at, daily_rate, status, notes
    )
    values (
      v_booking, 'BK-' || lpad(v.n::text, 5, '0'), v_partner, c_dxb, v_category, v_seat,
      v_pickup, v_ret, v.rate, 'pending', 'KPI demo'
    );
    update public.bookings set status = 'confirmed' where id = v_booking;

    perform set_config('request.jwt.claim.sub', v_tech::text, false);
    update public.bookings set status = 'in_progress' where id = v_booking;

    -- The installation: the job (its deadline is the pickup time minus 60 minutes), the scan of the seat, the
    -- record of the work, and the job moved through its statuses by its technician.
    if v.scan <> 'x' then
      insert into public.technician_jobs (id, booking_id, technician_id, job_type, assigned_at, vehicle_bay)
      values (v_job, v_booking, v_tech, 'installation', v_pickup - interval '1 day', 'Bay ' || ((v.n % 6) + 1));

      -- The result is read from the scans when the installation is recorded; none means no result stored.
      if v.scan in ('t', 'f') then
        insert into public.installation_seat_scans (technician_job_id, assigned_seat_id, scanned_seat_id, matched, scanned_by)
        values (v_job, v_seat, case when v.scan = 't' then v_seat else c_other_seat end, v.scan = 't', v_tech);
      end if;

      insert into public.installations (
        id, technician_job_id, seat_verified, category_verified, installation_completed,
        vehicle_location, notes, completed_at
      )
      values (
        ('11100000-0000-0000-0000-' || lpad(v.n::text, 12, '0'))::uuid, v_job, true, true, true,
        'Bay ' || ((v.n % 6) + 1), 'Installed and checked', v_pickup - interval '1 day' + interval '9 hours'
      );

      perform set_config('app.job_status_change', 'on', false);
      update public.technician_jobs
         set status = 'in_progress', started_at = assigned_at + interval '30 minutes'
       where id = v_job;
      update public.technician_jobs
         set status = 'completed', completed_at = started_at + interval '45 minutes'
       where id = v_job;
      perform set_config('app.job_status_change', '', false);
    end if;

    -- The moment the seat was Family Ready, against the deadline of the installation job.
    if v.fr <> 'none' then
      update public.bookings
         set family_ready_at = case v.fr
               when 'on' then (select j.deadline_at from public.technician_jobs j where j.id = v_job) - interval '25 minutes'
               when 'late' then (select j.deadline_at from public.technician_jobs j where j.id = v_job) + interval '20 minutes'
               else v_pickup - interval '90 minutes'
             end,
             family_ready_by = c_ops
       where id = v_booking;
    end if;

    -- The seat is cleaned and inspected after the rental, by the third technician.
    if v.cleaned then
      insert into public.cleaning_records (
        id, seat_id, booking_id, employee_id, started_at, completed_at, checklist, passed, notes
      )
      values (
        ('12100000-0000-0000-0000-' || lpad(v.n::text, 12, '0'))::uuid, v_seat, v_booking, c_tech3,
        v_ret + interval '2 hours', v_ret + interval '2 hours 45 minutes',
        '{"surfaces_wiped": true, "harness_checked": true}'::jsonb, true, 'Cleaned for the next rental'
      );
    end if;

    if v.inspected then
      insert into public.inspection_records (
        id, seat_id, booking_id, inspector_id, inspection_type, result, checklist, notes
      )
      values (
        ('13100000-0000-0000-0000-' || lpad(v.n::text, 12, '0'))::uuid, v_seat, v_booking, c_tech3,
        'general', 'pass', '{"harness_clip": "ok", "shell": "ok"}'::jsonb, 'Passed inspection'
      );
    end if;

    -- The rental is closed by operations; closing it calculates its paid days and its revenue shares.
    perform set_config('request.jwt.claim.sub', c_ops::text, false);
    update public.bookings set status = 'completed' where id = v_booking;

    -- Incidents of the rental, reported by its technician.
    perform set_config('request.jwt.claim.sub', v_tech::text, false);
    for i in 1..v.incident_count loop
      insert into public.incidents (id, partner_id, booking_id, seat_id, type, severity, description, reported_by)
      values (
        ('14100000-0000-0000-0000-' || lpad((v.n * 10 + i)::text, 12, '0'))::uuid, v_partner, v_booking, v_seat,
        'installation', 'low', 'KPI demo: small scratch on the shell found at installation', v_tech
      );
    end loop;
  end loop;

  alter table public.bookings enable trigger set_bookings_family_ready;

  -- The next booking made in the app does not take a number of this file.
  perform setval(
    'public.booking_number_seq',
    greatest((select last_value from public.booking_number_seq), 131)
  );

  perform set_config('app.booking_change', '', false);
  perform set_config('app.job_status_change', '', false);
  perform set_config('request.jwt.claim.sub', '', false);

  -- What the KPI functions give for each month, for both partners together, so the load can be checked at once.
  for m in select unnest(array['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']) loop
    for r in
      select
        (select s.completed_bookings || ' completed, seat ' || s.matched || '/' || s.with_result
           from public.kpi_correct_seat_figures((m || '-01')::timestamptz, ((m || '-01')::date + interval '1 month')::timestamptz) s) as seat,
        (select o.family_ready_bookings || ' Family Ready, on time ' || o.on_time || '/' || o.with_deadline
           from public.kpi_on_time_readiness_figures((m || '-01')::timestamptz, ((m || '-01')::date + interval '1 month')::timestamptz) o) as ready,
        (select t.traced_bookings || '/' || t.completed_bookings
           from public.kpi_traceability_figures((m || '-01')::timestamptz, ((m || '-01')::date + interval '1 month')::timestamptz) t) as traced,
        (select n.incidents
           from public.kpi_incident_figures((m || '-01')::timestamptz, ((m || '-01')::date + interval '1 month')::timestamptz) n) as incidents,
        (select c.partner_revenue || ' (' || c.with_revenue || ' with a share)'
           from public.kpi_commercial_figures((m || '-01')::timestamptz, ((m || '-01')::date + interval '1 month')::timestamptz) c) as revenue
    loop
      raise notice 'KPI % | % | % | traced % | incidents % | partner revenue %', m, r.seat, r.ready, r.traced, r.incidents, r.revenue;
    end loop;
  end loop;
end
$kpi$;
