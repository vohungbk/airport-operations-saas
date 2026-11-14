-- FO-F06-S06: a step that needs a photo cannot complete without one.
--
-- Which steps need a photo (spec question Q1, answered as: installation and incident):
--   * recording an installation needs at least one booking photo of type installation on the job's booking;
--   * reporting an incident on a job needs at least one booking photo of type incident on the job's booking.
-- The photo is added first (record_booking_photo), then the step is saved. Return chain steps already
-- require their own photos (20261219090000); cleaning and inspection have no photo type and are unchanged.
--
-- The rule applies to a signed-in app caller (the JWT role is authenticated). Trusted inserts without such a
-- caller (seed data, a service-role job) are not blocked, as the guards already do for reported_by.
--
-- Both rules live in the existing guard triggers, so a client cannot skip them. The photo is looked up by
-- the booking of the job, which the guard reads from the database, never from the client.
--
-- Error code:
--   JB010  the step needs a photo and the booking has none of the needed type
--
-- Everything else in the two guard functions is unchanged.

create or replace function public.guard_installation_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_type public.technician_job_type;
  v_job_status public.technician_job_status;
  v_booking_id uuid;
  v_seat_id uuid;
  v_seat_status public.seat_status;
begin
  select tj.job_type, tj.status, tj.booking_id, b.assigned_seat_id
    into v_job_type, v_job_status, v_booking_id, v_seat_id
    from public.technician_jobs tj
    join public.bookings b on b.id = tj.booking_id
   where tj.id = new.technician_job_id;

  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  if v_job_type is distinct from 'installation' then
    raise exception 'The job is not an installation job' using errcode = 'JB005';
  end if;

  if v_job_status not in ('assigned', 'in_progress') then
    raise exception 'The job is not active' using errcode = 'JB006';
  end if;

  if v_seat_id is null then
    raise exception 'The booking has no seat assigned' using errcode = 'JB007';
  end if;

  select s.status
    into v_seat_status
    from public.seats s
   where s.id = v_seat_id;

  if v_seat_status not in ('available', 'reserved') then
    raise exception 'The seat is not in a status that allows installation'
      using errcode = 'JB007';
  end if;

  -- A small allowance for clock skew between the browser and the server.
  if new.completed_at is not null
     and new.completed_at > now() + interval '5 minutes' then
    raise exception 'Installation time cannot be in the future'
      using errcode = '22023';
  end if;

  if auth.role() = 'authenticated'
     and not exists (
       select 1
         from public.booking_photos bp
        where bp.booking_id = v_booking_id
          and bp.type = 'installation'
     ) then
    raise exception 'A photo is required for this step' using errcode = 'JB010';
  end if;

  new.seat_id := v_seat_id;

  select u.id
    into new.created_by
    from public.users u
   where u.id = auth.uid();

  return new;
end;
$$;

create or replace function public.guard_incident_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_technician_id uuid;
  v_job_type public.technician_job_type;
  v_booking_id uuid;
  v_partner_id uuid;
  v_seat_id uuid;
begin
  if new.technician_job_id is null then
    return new;
  end if;

  select u.role
    into v_role
    from public.users u
   where u.id = v_uid
     and u.is_active;

  select tj.technician_id, tj.job_type, tj.booking_id, b.partner_id, b.assigned_seat_id
    into v_technician_id, v_job_type, v_booking_id, v_partner_id, v_seat_id
    from public.technician_jobs tj
    join public.bookings b on b.id = tj.booking_id
   where tj.id = new.technician_job_id;

  if not found
     or (v_role = 'technician' and v_technician_id is distinct from v_uid) then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  if auth.role() = 'authenticated'
     and not exists (
       select 1
         from public.booking_photos bp
        where bp.booking_id = v_booking_id
          and bp.type = 'incident'
     ) then
    raise exception 'A photo is required for this step' using errcode = 'JB010';
  end if;

  new.booking_id := v_booking_id;
  new.seat_id := v_seat_id;
  new.partner_id := v_partner_id;
  new.type := v_job_type::text;
  new.status := 'open';
  new.resolved_by := null;
  new.resolved_at := null;

  -- The caller is the one who reported it. Without an app user (a trusted
  -- server insert) the given reported_by is kept.
  new.reported_by := coalesce(
    (select u.id from public.users u where u.id = v_uid),
    new.reported_by
  );

  return new;
end;
$$;

-- Rollback (run manually against the target database if needed): re-run the two function bodies from
-- 20261018090000_installation_record_guard.sql and 20261028090000_incident_report_guard.sql.
