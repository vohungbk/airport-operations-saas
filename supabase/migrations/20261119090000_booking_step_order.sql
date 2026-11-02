-- CO-F08-S02: a booking follows a fixed step order.
--
-- The steps of a booking that runs its course, in order:
--   1 pending (New) -> 2 confirmed -> 3 assigned -> 4 in_progress -> 5 completed
-- cancelled and no_show are not steps: they leave the path. A booking is created at
-- step 1 (create_booking() always sets 'pending'), and its status can only move to the
-- next step, or leave the path as the booking functions allow today:
--   pending -> cancelled, confirmed -> cancelled | no_show.
-- Nothing else: no skipped step, no step back, nothing out of completed, cancelled or
-- no_show. change_booking_status() already checks this for the manual changes; this
-- trigger holds for every writer of bookings.status that runs as a client role, including
-- the workflows that will set assigned, in_progress and completed (F14, F15). A SECURITY
-- DEFINER function owned by postgres runs as the owner and is exempt (see below), so a
-- workflow written that way must follow booking_step_order() itself.
--
-- No data is migrated: there is no step column, a booking's step is read from its status,
-- and every status of the enum already has its place (or is off the path), so a booking
-- created before this model is mapped by its current status.
--
-- Owner roles (postgres, supabase_admin) are exempt, like the other bookings guards: the
-- seed and the migrations run as the owner; PostgREST never connects as those roles.
-- Error code 55000, as the other bookings guards. SECURITY INVOKER; reads no tables.

-- The position of a status on the path; NULL for a status that is off the path.
create function public.booking_step_order(p_status public.booking_status)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'pending' then 1
    when 'confirmed' then 2
    when 'assigned' then 3
    when 'in_progress' then 4
    when 'completed' then 5
    else null
  end;
$$;

create function public.guard_booking_step_order()
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
  if (old.status = 'pending' and new.status = 'cancelled')
     or (old.status = 'confirmed' and new.status in ('cancelled', 'no_show')) then
    return new;
  end if;

  raise exception 'Invalid booking step order: % -> %', old.status, new.status
    using errcode = '55000';
end;
$$;

revoke execute on function public.guard_booking_step_order() from public;
revoke execute on function public.guard_booking_step_order() from anon;

create trigger guard_bookings_step_order
  before update of status on public.bookings
  for each row
  execute function public.guard_booking_step_order();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists guard_bookings_step_order on public.bookings;
-- drop function if exists public.guard_booking_step_order();
-- drop function if exists public.booking_step_order(public.booking_status);
