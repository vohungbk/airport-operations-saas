-- VI-F05-T01: store the inputs the KPI formulas need.
--
-- Three figures could not be calculated because their inputs were not stored:
--   * the deadline of a job            -> technician_jobs.deadline_at
--   * the moment a booking is Family Ready -> bookings.family_ready_at / family_ready_by
--   * whether the installed seat was the allocated seat -> installation_seat_scans (a log of every
--     scan) and installations.seat_match (the result the installation carries)
--
-- Every new column is nullable and nothing is back-filled: rows that exist before this migration
-- keep empty values, they are not guessed (AC06).
--
-- Deadline rule (installation jobs only):
--   deadline_at = booking.pickup_at - 60 minutes + delay of the linked flight
--   delay       = max(gap, 0), where gap is read as the screens read it (flight-timing.ts): the actual
--                 or else the estimated arrival minus the scheduled arrival, and delay_minutes only
--                 when there is neither. A flight that is on time, early or unknown, or a booking
--                 with no flight, adds nothing.
-- The deadline is always counted from the pickup time, so a second estimate replaces the first one
-- and never adds to it. Only open jobs (assigned, in_progress) move, and only jobs that already
-- have a deadline, so a job from before this migration stays empty.
--
-- Error codes of record_installation_seat_scan():
--   42501  not signed in, not allowed to scan for this job (the same code for a job that does not exist)
--   22023  the kind is not 'token' or 'serial', or the value is empty or too long
--   JB005  the job is not an installation job
--   JB006  the job is not active (assigned or in_progress)
--   JB007  the booking has no seat assigned

-- -----------------------------------------------------------------------------
-- 1. Job deadline
-- -----------------------------------------------------------------------------
alter table public.technician_jobs
  add column deadline_at timestamptz;

create function public.installation_job_deadline(p_pickup_at timestamptz, p_flight_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select p_pickup_at
         - interval '60 minutes'
         + coalesce(
             (select greatest(
                       case
                         when coalesce(f.actual_arrival_at, f.estimated_arrival_at) is not null
                           then coalesce(f.actual_arrival_at, f.estimated_arrival_at) - f.scheduled_arrival_at
                         else make_interval(mins => coalesce(f.delay_minutes, 0))
                       end,
                       interval '0')
                from public.flights f
               where f.id = p_flight_id),
             interval '0'
           );
$$;

-- Moves the deadline of the open installation jobs that already have one. Pass a booking, a flight,
-- or both. The transaction-local signal lets guard_technician_job_deadline() through.
create function public.refresh_installation_job_deadlines(p_booking_id uuid, p_flight_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.job_deadline_change', 'on', true);

  update public.technician_jobs tj
     set deadline_at = x.deadline
    from (
      select j.id, public.installation_job_deadline(b.pickup_at, b.flight_id) as deadline
        from public.technician_jobs j
        join public.bookings b on b.id = j.booking_id
       where j.job_type = 'installation'
         and j.status in ('assigned', 'in_progress')
         and j.deadline_at is not null
         and (p_booking_id is null or b.id = p_booking_id)
         and (p_flight_id is null or b.flight_id = p_flight_id)
    ) x
   where tj.id = x.id
     and tj.deadline_at is distinct from x.deadline;

  perform set_config('app.job_deadline_change', '', true);
end;
$$;

-- A new installation job gets its deadline from the booking; whatever the client sent is dropped.
create function public.set_technician_job_deadline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.deadline_at := null;

  if new.job_type = 'installation' then
    select public.installation_job_deadline(b.pickup_at, b.flight_id)
      into new.deadline_at
      from public.bookings b
     where b.id = new.booking_id;
  end if;

  return new;
end;
$$;

-- The deadline changes only through refresh_installation_job_deadlines(). A direct update by a
-- technician or an operations manager keeps the old value.
create function public.guard_technician_job_deadline()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(nullif(btrim(current_setting('app.job_deadline_change', true)), ''), 'off') <> 'on' then
    new.deadline_at := old.deadline_at;
  end if;

  return new;
end;
$$;

create function public.refresh_job_deadlines_on_flight_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_installation_job_deadlines(null, new.id);
  return null;
end;
$$;

create function public.refresh_job_deadlines_on_booking_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_installation_job_deadlines(new.id, null);
  return null;
end;
$$;

create trigger set_technician_jobs_deadline
  before insert on public.technician_jobs
  for each row
  execute function public.set_technician_job_deadline();

create trigger guard_technician_jobs_deadline
  before update on public.technician_jobs
  for each row
  when (new.deadline_at is distinct from old.deadline_at)
  execute function public.guard_technician_job_deadline();

create trigger refresh_job_deadlines_after_flight_update
  after update of scheduled_arrival_at, estimated_arrival_at, actual_arrival_at, delay_minutes on public.flights
  for each row
  when (
    old.scheduled_arrival_at is distinct from new.scheduled_arrival_at
    or old.estimated_arrival_at is distinct from new.estimated_arrival_at
    or old.actual_arrival_at is distinct from new.actual_arrival_at
    or old.delay_minutes is distinct from new.delay_minutes
  )
  execute function public.refresh_job_deadlines_on_flight_change();

create trigger refresh_job_deadlines_after_booking_update
  after update of pickup_at, flight_id on public.bookings
  for each row
  when (
    old.pickup_at is distinct from new.pickup_at
    or old.flight_id is distinct from new.flight_id
  )
  execute function public.refresh_job_deadlines_on_booking_change();

-- -----------------------------------------------------------------------------
-- 2. Family Ready moment and actor
-- -----------------------------------------------------------------------------
alter table public.bookings
  add column family_ready_at timestamptz,
  add column family_ready_by uuid references public.users(id) on delete set null;

-- Set when the booking reaches Family Ready; every other update keeps the stored values, so a
-- client cannot write them.
create function public.set_booking_family_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'family_ready' and old.status is distinct from 'family_ready' then
    new.family_ready_at := now();

    select u.id
      into new.family_ready_by
      from public.users u
     where u.id = auth.uid();
  else
    new.family_ready_at := old.family_ready_at;
    new.family_ready_by := old.family_ready_by;
  end if;

  return new;
end;
$$;

create trigger set_bookings_family_ready
  before update on public.bookings
  for each row
  execute function public.set_booking_family_ready();

-- -----------------------------------------------------------------------------
-- 3. Seat scans and the match carried by the installation
-- -----------------------------------------------------------------------------
create table public.installation_seat_scans (
  id uuid primary key default gen_random_uuid(),
  technician_job_id uuid not null references public.technician_jobs(id) on delete restrict,
  -- The seat of the booking when the scan was made (the booking's seat may change later).
  assigned_seat_id uuid not null references public.seats(id) on delete restrict,
  -- The seat the code names; empty when the code names no seat.
  scanned_seat_id uuid references public.seats(id) on delete restrict,
  matched boolean not null,
  scanned_by uuid references public.users(id) on delete set null,
  -- clock_timestamp(), not now(): scans in one transaction still sort in the order they were made.
  scanned_at timestamptz not null default clock_timestamp()
);

create index installation_seat_scans_job_idx
  on public.installation_seat_scans (technician_job_id, scanned_at desc);

alter table public.installation_seat_scans enable row level security;

create policy "installation_seat_scans_select_admin_ops_manager"
  on public.installation_seat_scans for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "installation_seat_scans_select_technician"
  on public.installation_seat_scans for select
  to authenticated
  using (
    exists (
      select 1
      from public.technician_jobs tj
      where tj.id = installation_seat_scans.technician_job_id
        and tj.technician_id = (select auth.uid())
    )
  );

create policy "installation_seat_scans_select_partner_user"
  on public.installation_seat_scans for select
  to authenticated
  using (
    exists (
      select 1
      from public.technician_jobs tj
      join public.bookings b on b.id = tj.booking_id
      where tj.id = installation_seat_scans.technician_job_id
        and b.partner_id = (select public.current_user_partner_id())
    )
  );

-- The log is written by record_installation_seat_scan() only and never changed: no INSERT, UPDATE or
-- DELETE policy exists, and the grants go as well so the log does not depend on RLS alone.
revoke all on public.installation_seat_scans from anon, authenticated;
grant select on public.installation_seat_scans to authenticated;

create function public.record_installation_seat_scan(
  p_job_id uuid,
  p_kind text,
  p_value text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_job record;
  v_scanned uuid;
  v_matched boolean;
begin
  if v_user is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select tj.id, tj.job_type, tj.status, tj.technician_id, b.assigned_seat_id
    into v_job
    from public.technician_jobs tj
    join public.bookings b on b.id = tj.booking_id
   where tj.id = p_job_id;

  if not found
     or not (
       coalesce(public.is_admin_or_ops_manager(), false)
       or (coalesce(public.current_user_role() = 'technician', false) and v_job.technician_id = v_user)
     ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if coalesce(p_kind, '') not in ('token', 'serial') or nullif(btrim(p_value), '') is null or length(p_value) > 200 then
    raise exception 'The scanned code is not valid' using errcode = '22023';
  end if;

  if v_job.job_type is distinct from 'installation' then
    raise exception 'The job is not an installation job' using errcode = 'JB005';
  end if;

  if v_job.status not in ('assigned', 'in_progress') then
    raise exception 'The job is not active' using errcode = 'JB006';
  end if;

  if v_job.assigned_seat_id is null then
    raise exception 'The booking has no seat assigned' using errcode = 'JB007';
  end if;

  -- The code is looked up here, with the owner's rights, so a code that names a seat the
  -- technician cannot read is still stored with its seat. The caller never learns which seat it is.
  -- A serial is read as getSeatBySerial() reads it: the exact text first, then the same text in
  -- another case when that names one seat.
  if p_kind = 'token' then
    select s.id into v_scanned from public.seats s where s.public_token = btrim(p_value);
  else
    select s.id into v_scanned from public.seats s where s.serial_number = btrim(p_value);

    if v_scanned is null then
      select min(s.id::text)::uuid
        into v_scanned
        from public.seats s
       where lower(s.serial_number) = lower(btrim(p_value))
      having count(*) = 1;
    end if;
  end if;

  v_matched := v_scanned is not null and v_scanned = v_job.assigned_seat_id;

  insert into public.installation_seat_scans (
    technician_job_id, assigned_seat_id, scanned_seat_id, matched, scanned_by
  )
  values (v_job.id, v_job.assigned_seat_id, v_scanned, v_matched, v_user);

  return v_matched;
end;
$$;

revoke execute on function public.record_installation_seat_scan(uuid, text, text) from public;
revoke execute on function public.record_installation_seat_scan(uuid, text, text) from anon;
grant execute on function public.record_installation_seat_scan(uuid, text, text) to authenticated;

alter table public.installations
  add column seat_match boolean;

-- The installation carries the result of the latest scan of its job made against the seat it was
-- recorded for: true is a correct seat, false a mismatch, empty means no such scan (also every
-- installation from before this migration). Whatever the client sent is dropped. The guard trigger
-- guard_installations_insert runs first and sets seat_id.
create function public.set_installation_seat_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.seat_match := null;

  select s.matched
    into new.seat_match
    from public.installation_seat_scans s
   where s.technician_job_id = new.technician_job_id
     and s.assigned_seat_id = new.seat_id
   order by s.scanned_at desc, s.id desc
   limit 1;

  return new;
end;
$$;

create trigger set_installations_seat_match
  before insert on public.installations
  for each row
  execute function public.set_installation_seat_match();

-- Trigger functions and internal helpers are not callable by clients.
revoke execute on function public.installation_job_deadline(timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.refresh_installation_job_deadlines(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.set_technician_job_deadline() from public, anon, authenticated;
revoke execute on function public.guard_technician_job_deadline() from public, anon, authenticated;
revoke execute on function public.refresh_job_deadlines_on_flight_change() from public, anon, authenticated;
revoke execute on function public.refresh_job_deadlines_on_booking_change() from public, anon, authenticated;
revoke execute on function public.set_booking_family_ready() from public, anon, authenticated;
revoke execute on function public.set_installation_seat_match() from public, anon, authenticated;

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists set_installations_seat_match on public.installations;
-- drop function if exists public.set_installation_seat_match();
-- alter table public.installations drop column if exists seat_match;
-- drop function if exists public.record_installation_seat_scan(uuid, text, text);
-- drop table if exists public.installation_seat_scans;
-- drop trigger if exists set_bookings_family_ready on public.bookings;
-- drop function if exists public.set_booking_family_ready();
-- alter table public.bookings drop column if exists family_ready_by, drop column if exists family_ready_at;
-- drop trigger if exists refresh_job_deadlines_after_booking_update on public.bookings;
-- drop trigger if exists refresh_job_deadlines_after_flight_update on public.flights;
-- drop trigger if exists guard_technician_jobs_deadline on public.technician_jobs;
-- drop trigger if exists set_technician_jobs_deadline on public.technician_jobs;
-- drop function if exists public.refresh_job_deadlines_on_booking_change();
-- drop function if exists public.refresh_job_deadlines_on_flight_change();
-- drop function if exists public.guard_technician_job_deadline();
-- drop function if exists public.set_technician_job_deadline();
-- drop function if exists public.refresh_installation_job_deadlines(uuid, uuid);
-- drop function if exists public.installation_job_deadline(timestamptz, uuid);
-- alter table public.technician_jobs drop column if exists deadline_at;
