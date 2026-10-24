-- VI-F07-S01: demo accounts and operational flows on top of the F02 base seed.
--
-- Runs after supabase/seed.sql (see [db.seed] in supabase/config.toml), so
-- `npx supabase db reset` loads both. Nothing in the base seed is changed.
--
--   * Every column of every row is the same on every load (VI-F07-S02): the ids
--     are fixed literals, and the values the system would set (created_at,
--     updated_at, the ids and times of the audit rows the triggers write) are
--     made fixed in the last step below. Nothing here reads the clock, a random
--     number or a sequence that other data can move.
--   * It is one statement, so it is all or nothing: if anything fails, nothing
--     of it is kept (spec E3, rerun `npm run demo:reset`).
--   * It refuses to run next to real data (spec E1): if a user with an address
--     that is not a demo or test address exists, it stops, even on a rerun.
--   * Loading it again does nothing (spec E2): a marker row says it is loaded.
--   * No real person, address, number or credential (spec R3): every address
--     ends in .example, and the one password below is a public demo value for
--     a local database only.
--
-- History (booking events, seat history, job events, incident history) is made
-- by the same triggers the app uses, by moving each record through its real
-- statuses, so it matches the current state. The signals the guard triggers
-- read (app.*) are set only for the statements that need them.
--
-- Each step is done as the person who would do it (VI-F07-S04): the seed sets
-- request.jwt.claim.sub, which is what auth.uid() reads, so the triggers write
-- that person as the actor of the event. Partner users make their requests,
-- the operations manager confirms and completes bookings and resolves incidents,
-- the admin marks a no-show, and each technician runs their own jobs, records
-- the work and reports incidents. So every role has records of its own, and the
-- timelines say who did what. The actors are constants, so two loads are equal.
--
-- Accounts (all with the demo password, see docs/database.md):
--   admin@airportops.example            admin
--   ops.manager@airportops.example      operations_manager
--   partner.dcr@airportops.example      partner_user of Demo Car Rental
--   partner.dmo@airportops.example      partner_user of Demo Mobility
--   technician1..3@airportops.example   technician

do $demo$
declare
  c_password constant text := 'DemoPassw0rd!';
  -- bcrypt with a fixed salt, so the stored hash is the same on every load.
  c_hash constant text := extensions.crypt(c_password, '$2a$10$DemoSeedFixedSaltAbcd.');
  c_instance constant uuid := '00000000-0000-0000-0000-000000000000';
  -- The one moment every system timestamp of the seed is set to.
  c_base constant timestamptz := timestamptz '2026-08-01 00:00:00+00';
  c_dcr constant uuid := 'b0000000-0000-0000-0000-000000000001';
  c_dmo constant uuid := 'b0000000-0000-0000-0000-000000000002';
  c_dxb constant uuid := 'a0000000-0000-0000-0000-000000000001';
  c_ops constant uuid := 'a1000000-0000-0000-0000-000000000002';
  c_tech1 constant uuid := 'd0000000-0000-0000-0000-000000000001';
  c_tech2 constant uuid := 'd0000000-0000-0000-0000-000000000002';
  c_tech3 constant uuid := 'd0000000-0000-0000-0000-000000000003';
  c_admin constant uuid := 'a1000000-0000-0000-0000-000000000001';
  c_partner_dcr constant uuid := 'a1000000-0000-0000-0000-000000000003';
  c_partner_dmo constant uuid := 'a1000000-0000-0000-0000-000000000004';
  v record;
begin
  -- Spec E1: real accounts exist, so this is not a demo or test database.
  if exists (
    select 1 from public.users
     where email !~* '(\.example|@test\.local)$'
  ) or exists (
    select 1 from auth.users
     where email !~* '(\.example|@test\.local)$'
  ) then
    raise exception 'refusing to load demo data: accounts with real addresses exist';
  end if;

  -- Spec E2: already loaded.
  if exists (select 1 from public.users where id = 'a1000000-0000-0000-0000-000000000001') then
    raise notice 'demo data is already loaded; nothing to do';
    return;
  end if;

  ---------------------------------------------------------------------------
  -- Accounts: one per role, two partner users (one per partner, to show
  -- isolation), and the three technicians of the base seed made able to sign in.
  ---------------------------------------------------------------------------
  insert into public.users (id, email, full_name, role, partner_id, is_active)
  values
    (c_admin, 'admin@airportops.example', 'Demo Admin', 'admin', null, true),
    (c_ops, 'ops.manager@airportops.example', 'Demo Operations Manager', 'operations_manager', null, true),
    (c_partner_dcr, 'partner.dcr@airportops.example', 'Demo Car Rental Partner User', 'partner_user', c_dcr, true),
    (c_partner_dmo, 'partner.dmo@airportops.example', 'Demo Mobility Partner User', 'partner_user', c_dmo, true)
  on conflict (id) do nothing;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    c_instance, u.id, 'authenticated', 'authenticated', u.email, c_hash, c_base,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('full_name', u.full_name),
    c_base, c_base, '', '', '', ''
  from public.users u
  where u.email like '%@airportops.example'
  on conflict (id) do nothing;

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  select
    md5('identity:' || u.id::text)::uuid, u.id::text, u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
    'email', c_base, c_base, c_base
  from public.users u
  where u.email like '%@airportops.example'
    and not exists (select 1 from auth.identities i where i.user_id = u.id);

  ---------------------------------------------------------------------------
  -- Bookings: ten more, in the statuses a demo needs. Seats 21 to 28 are unused
  -- by the base seed; a seat always has the category and the airport of its
  -- booking, and no two active bookings share a seat. They are made `pending`
  -- and moved through their real statuses below, so the history is real.
  -- Numbers follow the base seed (BK-00001 to BK-00020), and the sequence the
  -- app uses is moved past them, so the next booking made in the app is BK-00031.
  ---------------------------------------------------------------------------
  -- A partner user makes their own pending request; operations make the rest,
  -- with the seat. One insert per booking, each as its own actor.
  for v in
    select * from (
      values
        (21, 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', null,                                   '2026-09-10 09:00:00+04', '2026-09-13 09:00:00+04', 75.00, 'Waiting for confirmation', c_partner_dcr),
        (22, 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', null,                                   '2026-09-10 10:00:00+04', '2026-09-12 10:00:00+04', 80.00, null, c_partner_dmo),
        (23, 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000021', '2026-09-05 08:00:00+04', '2026-09-08 08:00:00+04', 80.00, 'On rental', c_ops),
        (24, 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000022', '2026-09-05 09:00:00+04', '2026-09-09 09:00:00+04', 70.00, 'On rental', c_ops),
        (25, 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000023', '2026-08-20 08:00:00+04', '2026-08-23 08:00:00+04', 90.00, null, c_ops),
        (26, 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000024', '2026-08-21 08:00:00+04', '2026-08-24 08:00:00+04', 75.00, null, c_ops),
        (27, 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', null,                                   '2026-09-12 08:00:00+04', '2026-09-14 08:00:00+04', 70.00, null, c_ops),
        (28, 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000027', '2026-09-01 08:00:00+04', '2026-09-03 08:00:00+04', 90.00, null, c_ops),
        (29, 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000025', '2026-09-15 08:00:00+04', '2026-09-18 08:00:00+04', 80.00, 'Upcoming: seat is being prepared', c_ops),
        (30, 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000026', '2026-09-16 08:00:00+04', '2026-09-19 08:00:00+04', 70.00, 'Upcoming: seat failed inspection', c_ops)
    ) as t(n, partner_id, category_id, seat_id, pickup_at, return_at, daily_rate, notes, actor)
    order by n
  loop
    perform set_config('request.jwt.claim.sub', v.actor::text, false);

    insert into public.bookings (
      id, booking_number, partner_id, airport_id, seat_category_id, assigned_seat_id,
      pickup_at, return_at, daily_rate, status, notes
    )
    values (
      ('f0000000-0000-0000-0000-' || lpad(v.n::text, 12, '0'))::uuid,
      'BK-' || lpad(v.n::text, 5, '0'),
      v.partner_id::uuid, c_dxb, v.category_id::uuid, v.seat_id::uuid,
      v.pickup_at::timestamptz, v.return_at::timestamptz, v.daily_rate, 'pending', v.notes
    );
  end loop;

  perform setval('public.booking_number_seq', 30);

  -- Statuses. The guard on bookings lets a status change only while this signal
  -- is on; each change writes its event through the trigger.
  perform set_config('app.booking_change', 'on', false);

  -- Operations confirm.
  perform set_config('request.jwt.claim.sub', c_ops::text, false);
  update public.bookings set status = 'confirmed'
   where id in (select ('f0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
                  from unnest(array[23, 24, 25, 26, 28, 29, 30]) as n);

  -- The rental starts: the technician who installed the seat.
  for v in
    select * from (values (23, c_tech1), (24, c_tech2), (25, c_tech1), (26, c_tech2)) as t(n, actor)
    order by n
  loop
    perform set_config('request.jwt.claim.sub', v.actor::text, false);
    update public.bookings set status = 'in_progress'
     where id = ('f0000000-0000-0000-0000-' || lpad(v.n::text, 12, '0'))::uuid;
  end loop;

  perform set_config('request.jwt.claim.sub', c_ops::text, false);
  perform set_config('app.booking_event_notes', 'Customer changed their plans', false);
  update public.bookings set status = 'cancelled'
   where id = 'f0000000-0000-0000-0000-000000000027';

  -- The admin marks the no-show.
  perform set_config('request.jwt.claim.sub', c_admin::text, false);
  perform set_config('app.booking_event_notes', 'Customer did not arrive', false);
  update public.bookings set status = 'no_show'
   where id = 'f0000000-0000-0000-0000-000000000028';
  perform set_config('app.booking_event_notes', '', false);

  ---------------------------------------------------------------------------
  -- Technician jobs. A job is made while its booking is active, then moved
  -- through its statuses (the update trigger writes the job events). The record
  -- of the work (installation, cleaning, inspection) is made while the job is
  -- active, as the app does.
  ---------------------------------------------------------------------------
  insert into public.technician_jobs (id, booking_id, technician_id, job_type, assigned_at, vehicle_bay)
  values
    ('10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000023', c_tech1, 'installation', '2026-09-04 18:00:00+04', 'Bay 3'),
    ('10000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000024', c_tech2, 'installation', '2026-09-04 18:30:00+04', 'Bay 5'),
    ('10000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000025', c_tech1, 'installation', '2026-08-19 18:00:00+04', 'Bay 2'),
    ('10000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000026', c_tech2, 'installation', '2026-08-20 18:00:00+04', 'Bay 4'),
    ('10000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000029', c_tech3, 'cleaning',     '2026-09-14 10:00:00+04', null),
    ('10000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000030', c_tech3, 'inspection',   '2026-09-15 10:00:00+04', null),
    ('10000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000029', c_tech3, 'inspection',   '2026-09-15 11:00:00+04', null),
    ('10000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000029', c_tech1, 'installation', '2026-09-15 12:00:00+04', 'Bay 1');

  -- Records of the work, written while the job is still active, as the
  -- technician who did it.
  perform set_config('request.jwt.claim.sub', c_tech1::text, false);
  insert into public.installations (
    id, technician_job_id, seat_verified, category_verified, installation_completed,
    vehicle_location, notes, completed_at
  )
  values
    ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', true, true, true, 'Bay 3', 'Installed and checked', '2026-09-05 07:30:00+04'),
    ('11000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', true, true, true, 'Bay 2', 'Installed and checked', '2026-08-20 07:30:00+04');

  perform set_config('request.jwt.claim.sub', c_tech2::text, false);
  insert into public.installations (
    id, technician_job_id, seat_verified, category_verified, installation_completed,
    vehicle_location, notes, completed_at
  )
  values
    ('11000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', true, true, true, 'Bay 4', 'Installed and checked', '2026-08-21 07:30:00+04');

  perform set_config('request.jwt.claim.sub', c_tech3::text, false);

  insert into public.cleaning_records (
    id, seat_id, booking_id, employee_id, started_at, completed_at, checklist, passed, notes, technician_job_id
  )
  values (
    '12000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000025',
    'f0000000-0000-0000-0000-000000000029', c_tech3,
    '2026-09-14 11:00:00+04', '2026-09-14 11:00:00+04',
    '{"surfaces_wiped": true, "harness_checked": true}'::jsonb, true, 'Cleaned for the next rental',
    '10000000-0000-0000-0000-000000000005'
  );

  -- A failed inspection quarantines the seat (the guard does it, with history).
  insert into public.inspection_records (
    id, seat_id, booking_id, inspector_id, inspection_type, result, checklist, notes, technician_job_id
  )
  values (
    '13000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000026',
    'f0000000-0000-0000-0000-000000000030', c_tech3, 'general', 'fail',
    '{"harness_clip": "cracked", "shell": "ok"}'::jsonb, 'Harness clip is cracked',
    '10000000-0000-0000-0000-000000000006'
  );

  -- Job statuses.
  perform set_config('app.job_status_change', 'on', false);

  -- Each job is moved by its own technician: started, then (the first five of
  -- these) completed.
  for v in
    select id, technician_id from public.technician_jobs
     where id in (
       '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
       '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004',
       '10000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000006')
     order by id
  loop
    perform set_config('request.jwt.claim.sub', v.technician_id::text, false);
    update public.technician_jobs
       set status = 'in_progress', started_at = assigned_at + interval '30 minutes'
     where id = v.id;
  end loop;

  for v in
    select id, technician_id from public.technician_jobs
     where id in (
       '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
       '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005',
       '10000000-0000-0000-0000-000000000006')
     order by id
  loop
    perform set_config('request.jwt.claim.sub', v.technician_id::text, false);
    update public.technician_jobs
       set status = 'completed', completed_at = started_at + interval '45 minutes'
     where id = v.id;
  end loop;

  perform set_config('app.job_status_change', '', false);

  -- The rentals that are over, closed by operations.
  perform set_config('request.jwt.claim.sub', c_ops::text, false);
  -- Completing a rental calculates its paid days and gross revenue (VI-F04-S04).
  update public.bookings set status = 'completed'
   where id in ('f0000000-0000-0000-0000-000000000025', 'f0000000-0000-0000-0000-000000000026');

  perform set_config('app.booking_change', '', false);

  ---------------------------------------------------------------------------
  -- Incidents. The guard takes the booking, seat, partner and type from the job.
  -- One is still open (the failed inspection); one went through its statuses and
  -- is resolved by the operations manager.
  ---------------------------------------------------------------------------
  -- Each is reported by the technician of the job.
  perform set_config('request.jwt.claim.sub', c_tech3::text, false);
  insert into public.incidents (
    id, partner_id, technician_job_id, type, severity, description, reported_by
  )
  values
    ('14000000-0000-0000-0000-000000000001', c_dmo, '10000000-0000-0000-0000-000000000006', 'inspection', 'high', 'Harness clip cracked at inspection; seat quarantined', c_tech3);

  perform set_config('request.jwt.claim.sub', c_tech1::text, false);
  insert into public.incidents (
    id, partner_id, technician_job_id, type, severity, description, reported_by
  )
  values
    ('14000000-0000-0000-0000-000000000002', c_dcr, '10000000-0000-0000-0000-000000000001', 'installation', 'low', 'Small scratch on the shell found at installation', c_tech1);

  -- Operations look into the second and resolve it.
  perform set_config('request.jwt.claim.sub', c_ops::text, false);
  perform set_config('app.incident_status_change', 'on', false);

  perform set_config('app.incident_status_notes', 'Looking into it', false);
  update public.incidents set status = 'investigating'
   where id = '14000000-0000-0000-0000-000000000002';

  perform set_config('app.incident_status_notes', 'Cosmetic only; seat is safe', false);
  update public.incidents set status = 'resolved', resolved_by = c_ops, resolved_at = timestamptz '2026-09-06 12:00:00+04'
   where id = '14000000-0000-0000-0000-000000000002';

  perform set_config('app.incident_status_notes', '', false);
  perform set_config('app.incident_status_change', '', false);
  perform set_config('request.jwt.claim.sub', '', false);

  ---------------------------------------------------------------------------
  -- Last step (VI-F07-S02): make fixed what the system set, so that two loads
  -- give the same data in every column, not only in the business columns.
  --
  --   * created_at and updated_at of the seeded rows are set to c_base. The
  --     triggers that keep updated_at and guard updates are off for this step.
  --   * The audit rows the triggers wrote (booking events, seat history, job
  --     events, incident history) get an id made from their table and their rank,
  --     and a time of c_base plus that rank in seconds. The rank keeps the order
  --     the events happened in, so every history still ends at the current
  --     status. The immutability triggers of these tables are off for this step
  --     only.
  --
  -- It touches only the seeded rows (found by their fixed ids), never the rows
  -- another suite added. The triggers are on again at the end of this block, and
  -- if anything fails the whole statement, the DDL included, is rolled back.
  ---------------------------------------------------------------------------
  alter table public.users disable trigger user;
  alter table public.partners disable trigger user;
  alter table public.airports disable trigger user;
  alter table public.seat_categories disable trigger user;
  alter table public.seats disable trigger user;
  alter table public.bookings disable trigger user;
  alter table public.technician_jobs disable trigger user;
  alter table public.incidents disable trigger user;
  alter table public.booking_events disable trigger user;
  alter table public.technician_job_events disable trigger user;
  alter table public.incident_status_history disable trigger user;
  alter table public.seat_status_history disable trigger user;

  update public.users set created_at = c_base, updated_at = c_base where email like '%.example';
  update public.partners set created_at = c_base, updated_at = c_base where id in (c_dcr, c_dmo);
  update public.airports set created_at = c_base, updated_at = c_base where id = c_dxb;
  update public.seat_categories set created_at = c_base, updated_at = c_base where id::text like 'c0000000-%';
  update public.seats set created_at = c_base, updated_at = c_base where id::text like 'e0000000-%';
  update public.bookings set created_at = c_base, updated_at = c_base where id::text like 'f0000000-%';
  update public.technician_jobs set created_at = c_base, updated_at = c_base where id::text like '10000000-%';
  update public.installations set created_at = c_base where id::text like '11000000-%';
  update public.cleaning_records set created_at = c_base where id::text like '12000000-%';
  update public.inspection_records set created_at = c_base where id::text like '13000000-%';
  update public.incidents set created_at = c_base, updated_at = c_base where id::text like '14000000-%';

  update public.booking_events e
     set id = md5('booking_events:' || r.n)::uuid,
         created_at = c_base + (r.n || ' seconds')::interval
    from (
      select id, row_number() over (
               order by created_at, booking_id, coalesce(from_status::text, ''),
                        to_status::text, coalesce(metadata::text, ''), coalesce(notes, '')
             ) as n
        from public.booking_events
       where booking_id::text like 'f0000000-%'
    ) r
   where e.id = r.id;

  update public.seat_status_history h
     set id = md5('seat_status_history:' || r.n)::uuid,
         created_at = c_base + (r.n || ' seconds')::interval
    from (
      select id, row_number() over (
               order by created_at, seat_id, coalesce(from_status::text, ''),
                        to_status::text, coalesce(reason, ''), coalesce(changed_by::text, '')
             ) as n
        from public.seat_status_history
       where seat_id::text like 'e0000000-%'
    ) r
   where h.id = r.id;

  update public.technician_job_events e
     set id = md5('technician_job_events:' || r.n)::uuid,
         created_at = c_base + (r.n || ' seconds')::interval
    from (
      select id, row_number() over (
               order by created_at, technician_job_id, coalesce(from_status::text, ''),
                        to_status::text, coalesce(notes, '')
             ) as n
        from public.technician_job_events
       where technician_job_id::text like '10000000-%'
    ) r
   where e.id = r.id;

  update public.incident_status_history h
     set id = md5('incident_status_history:' || r.n)::uuid,
         created_at = c_base + (r.n || ' seconds')::interval
    from (
      select id, row_number() over (
               order by created_at, incident_id, coalesce(from_status::text, ''),
                        to_status::text, coalesce(notes, '')
             ) as n
        from public.incident_status_history
       where incident_id::text like '14000000-%'
    ) r
   where h.id = r.id;

  alter table public.users enable trigger user;
  alter table public.partners enable trigger user;
  alter table public.airports enable trigger user;
  alter table public.seat_categories enable trigger user;
  alter table public.seats enable trigger user;
  alter table public.bookings enable trigger user;
  alter table public.technician_jobs enable trigger user;
  alter table public.incidents enable trigger user;
  alter table public.booking_events enable trigger user;
  alter table public.technician_job_events enable trigger user;
  alter table public.incident_status_history enable trigger user;
  alter table public.seat_status_history enable trigger user;
end
$demo$;
