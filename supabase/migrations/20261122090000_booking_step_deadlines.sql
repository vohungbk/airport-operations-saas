-- CO-F08-S07: each preparation step has a deadline from the pickup time, and a missed deadline
-- makes the booking overdue.
--
-- The deadline of a step is the time by which the booking has to have reached it, counted back
-- from the pickup time of the booking (pickup_at):
--   confirmed    24 hours before pickup
--   assigned      4 hours before pickup
--   in_progress   1 hour before pickup
--   pending, completed: no deadline (pending is where a booking starts; completed is the return)
-- The hours are the proposal for spec rule Q3 (still open with the PO); they are in one place,
-- booking_step_deadline_offset(), and in STEP_DEADLINE_HOURS in booking-deadlines.ts, which an
-- integration test checks against this function.
--
-- A booking is overdue when the deadline of its next step has passed. The next step has the
-- earliest deadline of the steps still to reach, so it is the only one to check. A booking at
-- completed, cancelled or no_show has no next step and is never overdue. Overdue is worked out
-- when it is read, not stored: time passes and no job is needed to mark a booking.
--
-- The functions read no table (SECURITY INVOKER, empty search_path), so row-level security has
-- nothing to add; the caller passes the values of a booking it can already read.

create function public.booking_step_deadline_offset(p_step public.booking_status)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_step
    when 'confirmed' then interval '24 hours'
    when 'assigned' then interval '4 hours'
    when 'in_progress' then interval '1 hour'
    else null
  end;
$$;

create function public.booking_step_deadline(p_step public.booking_status, p_pickup_at timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select p_pickup_at - public.booking_step_deadline_offset(p_step);
$$;

create function public.booking_is_overdue(
  p_status public.booking_status,
  p_pickup_at timestamptz,
  p_now timestamptz default now()
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    p_now > public.booking_step_deadline(
      (case public.booking_step_order(p_status)
        when 1 then 'confirmed'
        when 2 then 'assigned'
        when 3 then 'in_progress'
        else null
      end)::public.booking_status,
      p_pickup_at
    ),
    false
  );
$$;

revoke execute on function public.booking_step_deadline_offset(public.booking_status) from public;
revoke execute on function public.booking_step_deadline_offset(public.booking_status) from anon;
grant execute on function public.booking_step_deadline_offset(public.booking_status) to authenticated;

revoke execute on function public.booking_step_deadline(public.booking_status, timestamptz) from public;
revoke execute on function public.booking_step_deadline(public.booking_status, timestamptz) from anon;
grant execute on function public.booking_step_deadline(public.booking_status, timestamptz) to authenticated;

revoke execute on function public.booking_is_overdue(public.booking_status, timestamptz, timestamptz) from public;
revoke execute on function public.booking_is_overdue(public.booking_status, timestamptz, timestamptz) from anon;
grant execute on function public.booking_is_overdue(public.booking_status, timestamptz, timestamptz) to authenticated;

-- Rollback (run manually against the target database if needed):
-- drop function if exists public.booking_is_overdue(public.booking_status, timestamptz, timestamptz);
-- drop function if exists public.booking_step_deadline(public.booking_status, timestamptz);
-- drop function if exists public.booking_step_deadline_offset(public.booking_status);
