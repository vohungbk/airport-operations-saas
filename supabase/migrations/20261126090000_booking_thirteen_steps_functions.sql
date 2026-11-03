-- CO-F08 (D4 design): the functions of the 13-step path. Values are added in
-- 20261125090000_booking_thirteen_steps_enum.sql.
--
-- The path, with the status id of each step:
--    1 pending (New)            2 confirmed (Allocated)     3 preparation (Preparation)
--    4 ready (Ready)            5 assigned (Technician Assigned)   6 en_route (En Route)
--    7 installed (Installed)    8 family_ready (Family Ready)      9 in_progress (Active Rental)
--   10 returned (Returned)     11 cleaning (Cleaning)      12 inspection (Inspection)
--   13 completed (Available)
-- cancelled and no_show are off the path.
--
-- What changes:
--   booking_step_order()   the 13 positions; booking_step_at() is its inverse.
--   booking_seat_rule()    the seat follows at assigned (available -> reserved), in_progress
--                          (reserved -> in_use) and returned (in_use -> available: the seat is released
--                          and the cleaning and inspection of the seat start from it, see
--                          FO-F03). Cleaning, inspection and completed (Available) do not touch the seat:
--                          the cleaning and inspection records of the seat do that.
--   booking_seat_held()    the status the seat has while a booking is at a step (for a cancellation).
--   move_booking_to_next_step()   one step along the 13; a technician moves only to the field steps
--                          en_route, installed and family_ready, and only the booking assigned to them.
--   booking_is_overdue()   overdue once the first later step that has a deadline has passed it.
--   change_booking_status() / guard_booking_step_order()   a booking can be cancelled from any step
--                          that holds the seat or prepares it (pending to in_progress, except confirmed
--                          which can also be no_show); returned and later are final.
--   every function that lists the statuses that hold a seat for its period now lists the new ones
--   that still hold it (preparation, ready, en_route, installed, family_ready).
-- Same signatures, grants and error codes as before.

create or replace function public.booking_step_order(p_status public.booking_status)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'pending' then 1
    when 'confirmed' then 2
    when 'preparation' then 3
    when 'ready' then 4
    when 'assigned' then 5
    when 'en_route' then 6
    when 'installed' then 7
    when 'family_ready' then 8
    when 'in_progress' then 9
    when 'returned' then 10
    when 'cleaning' then 11
    when 'inspection' then 12
    when 'completed' then 13
    else null
  end;
$$;

create function public.booking_step_at(p_position integer)
returns public.booking_status
language sql
immutable
set search_path = ''
as $$
  select (case p_position
    when 1 then 'pending'
    when 2 then 'confirmed'
    when 3 then 'preparation'
    when 4 then 'ready'
    when 5 then 'assigned'
    when 6 then 'en_route'
    when 7 then 'installed'
    when 8 then 'family_ready'
    when 9 then 'in_progress'
    when 10 then 'returned'
    when 11 then 'cleaning'
    when 12 then 'inspection'
    when 13 then 'completed'
    else null
  end)::public.booking_status;
$$;

revoke execute on function public.booking_step_at(integer) from public;
revoke execute on function public.booking_step_at(integer) from anon;
grant execute on function public.booking_step_at(integer) to authenticated;

create or replace function public.booking_seat_rule(p_status public.booking_status)
returns table (seat_from public.seat_status, seat_to public.seat_status)
language sql
immutable
set search_path = ''
as $$
  select r.seat_from, r.seat_to
    from (
      values
        ('assigned'::public.booking_status, 'available'::public.seat_status, 'reserved'::public.seat_status),
        ('in_progress'::public.booking_status, 'reserved'::public.seat_status, 'in_use'::public.seat_status),
        ('returned'::public.booking_status, 'in_use'::public.seat_status, 'available'::public.seat_status)
    ) as r (step, seat_from, seat_to)
   where r.step = p_status;
$$;

-- The status the seat has while a booking is at a step; NULL when the step holds no seat.
create function public.booking_seat_held(p_status public.booking_status)
returns public.seat_status
language sql
immutable
set search_path = ''
as $$
  select (case p_status
    when 'assigned' then 'reserved'
    when 'en_route' then 'reserved'
    when 'installed' then 'reserved'
    when 'family_ready' then 'reserved'
    when 'in_progress' then 'in_use'
    else null
  end)::public.seat_status;
$$;

revoke execute on function public.booking_seat_held(public.booking_status) from public;
revoke execute on function public.booking_seat_held(public.booking_status) from anon;
grant execute on function public.booking_seat_held(public.booking_status) to authenticated;

create or replace function public.booking_is_overdue(
  p_status public.booking_status,
  p_pickup_at timestamptz,
  p_now timestamptz default now()
)
returns boolean
language sql
stable
set search_path = ''
as $$
  -- The first later step that has a deadline has the earliest one, so it is the only one to check;
  -- bool_or over all of them gives the same answer. A booking off the path has no later step.
  select coalesce(
    bool_or(p_now > public.booking_step_deadline(public.booking_step_at(g.position), p_pickup_at)),
    false
  )
  from generate_series(coalesce(public.booking_step_order(p_status), 13) + 1, 13) as g (position)
  where public.booking_step_deadline_offset(public.booking_step_at(g.position)) is not null;
$$;

create or replace function public.move_booking_to_next_step(
  p_booking_id uuid,
  p_expected_status public.booking_status,
  p_note text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_seat public.seats;
  v_note text := nullif(btrim(p_note), '');
  v_user uuid := auth.uid();
  v_is_manager boolean := coalesce(public.is_admin_or_ops_manager(), false);
  v_is_technician boolean := coalesce(public.current_user_role() = 'technician', false);
  v_to public.booking_status;
  v_seat_from public.seat_status;
  v_seat_to public.seat_status;
begin
  if v_user is null or not (v_is_manager or v_is_technician) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select *
    into v_booking
    from public.bookings b
   where b.id = p_booking_id
     for update;

  if not found then
    if v_is_manager then
      raise exception 'Booking not found' using errcode = 'P0002';
    end if;
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if not v_is_manager and v_booking.assigned_technician_id is distinct from v_user then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_booking.status is distinct from p_expected_status then
    raise exception 'The booking was changed by someone else'
      using errcode = 'BK007', detail = v_booking.status::text;
  end if;

  v_to := public.booking_step_at(public.booking_step_order(v_booking.status) + 1);

  if v_to is null then
    raise exception 'The booking has no next step: %', v_booking.status
      using errcode = '55000';
  end if;

  -- The field steps may be moved by the assigned technician; the others by managers only.
  if not v_is_manager and v_to not in ('en_route', 'installed', 'family_ready') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if length(v_note) > 500 then
    raise exception 'The note must be at most 500 characters' using errcode = '22023';
  end if;

  select r.seat_from, r.seat_to
    into v_seat_from, v_seat_to
    from public.booking_seat_rule(v_to) r;

  if found then
    if v_booking.assigned_seat_id is null then
      raise exception 'The booking has no seat' using errcode = 'BK008';
    end if;

    select *
      into v_seat
      from public.seats s
     where s.id = v_booking.assigned_seat_id
       for update;

    if v_seat.status is distinct from v_seat_from then
      raise exception 'The seat must be % before %', v_seat_from, v_to
        using errcode = 'BK009', detail = v_seat.status::text;
    end if;
  end if;

  perform set_config('app.booking_event_notes', coalesce(v_note, ''), true);
  perform set_config('app.booking_change', 'on', true);

  update public.bookings b
     set status = v_to
   where b.id = p_booking_id
  returning b.* into v_booking;

  perform set_config('app.booking_event_notes', '', true);
  perform set_config('app.booking_change', '', true);

  if v_seat_to is not null then
    perform public.apply_booking_seat_status(
      v_seat.id,
      v_seat_to,
      'Booking ' || v_booking.booking_number || ' moved to ' || v_to
    );
  end if;

  return v_booking;
end;
$$;

create or replace function public.change_booking_status(
  p_booking_id uuid,
  p_to_status public.booking_status,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_seat public.seats;
  v_reason text := nullif(btrim(p_reason), '');
  v_held public.seat_status;
begin
  -- coalesce: the helper returns NULL (not false) for inactive/unknown callers.
  if not coalesce(public.is_admin_or_ops_manager(), false) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select *
    into v_booking
    from public.bookings b
   where b.id = p_booking_id
     for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if not (
    (v_booking.status = 'pending' and p_to_status in ('confirmed', 'cancelled'))
    or (v_booking.status = 'confirmed' and p_to_status in ('cancelled', 'no_show'))
    or (
      v_booking.status in ('preparation', 'ready', 'assigned', 'en_route', 'installed', 'family_ready', 'in_progress')
      and p_to_status = 'cancelled'
    )
  ) then
    raise exception 'Invalid booking status transition: % -> %', v_booking.status, p_to_status
      using errcode = '55000';
  end if;

  if p_to_status in ('cancelled', 'no_show') and v_reason is null then
    raise exception 'A reason is required to cancel a booking or mark it as no-show'
      using errcode = '22023';
  end if;

  -- The seat the cancelled booking still holds, locked after the booking (same order as the move).
  if p_to_status = 'cancelled' and v_booking.assigned_seat_id is not null then
    v_held := public.booking_seat_held(v_booking.status);

    if v_held is not null then
      -- Locks the seat only when it is still in the status the step holds; otherwise v_seat stays empty.
      select *
        into v_seat
        from public.seats s
       where s.id = v_booking.assigned_seat_id
         and s.status = v_held
         for update;
    end if;
  end if;

  perform set_config('app.booking_event_notes', coalesce(v_reason, ''), true);
  perform set_config('app.booking_change', 'on', true);

  update public.bookings b
     set status = p_to_status
   where b.id = p_booking_id
  returning b.* into v_booking;

  perform set_config('app.booking_event_notes', '', true);
  perform set_config('app.booking_change', '', true);

  if v_seat.id is not null then
    perform public.apply_booking_seat_status(
      v_seat.id,
      'available',
      'Booking ' || v_booking.booking_number || ' cancelled'
    );
  end if;

  return v_booking;
end;
$$;

create or replace function public.guard_booking_step_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  -- On the path: only to the next step.
  if public.booking_step_order(old.status) is not null
     and public.booking_step_order(new.status) = public.booking_step_order(old.status) + 1 then
    return new;
  end if;

  -- Leaving the path, as change_booking_status() allows. Keep this list the same as that
  -- function and as MANUAL_STATUS_TRANSITIONS in booking-status.ts.
  if (old.status in ('pending', 'preparation', 'ready', 'assigned', 'en_route', 'installed', 'family_ready', 'in_progress')
      and new.status = 'cancelled')
     or (old.status = 'confirmed' and new.status in ('cancelled', 'no_show')) then
    return new;
  end if;

  raise exception 'Invalid booking step order: % -> %', old.status, new.status
    using errcode = '55000';
end;
$$;

-- The statuses that hold a seat for their period (the seat overlap checks of the booking,
-- partner, cleaning and inspection functions) gain the new steps that still hold it. The list
-- is replaced in every function that has it, as it stands now, so no copy of a function is kept
-- here. The migration stops if one is left.
do $$
declare
  v_old constant text := '(''pending'', ''confirmed'', ''assigned'', ''in_progress'')';
  v_new constant text := '(''pending'', ''confirmed'', ''preparation'', ''ready'', ''assigned'', ''en_route'', ''installed'', ''family_ready'', ''in_progress'')';
  v_function record;
begin
  for v_function in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and position(v_old in p.prosrc) > 0
  loop
    execute replace(pg_get_functiondef(v_function.oid), v_old, v_new);
  end loop;

  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and position(v_old in p.prosrc) > 0
  ) then
    raise exception 'A function still has the old list of statuses that hold a seat';
  end if;
end;
$$;

-- Rollback (run manually against the target database if needed): restore the functions from
-- 20261119090000_booking_step_order.sql, 20261121090000_link_seat_status_to_step.sql,
-- 20261122090000_booking_step_deadlines.sql, 20261124090000_cancel_releases_seat.sql and
-- 20261120090000_move_booking_to_next_step.sql, then
-- drop function if exists public.booking_seat_held(public.booking_status);
-- drop function if exists public.booking_step_at(integer);
-- and replace the longer list of holding statuses in the functions the last block of this file changed.
