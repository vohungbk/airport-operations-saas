-- CO-F08-T01: what the Workflow Board reads for each booking, from one rule in one place.
--
-- Three functions that take a booking row. PostgREST exposes a function like this as a computed
-- column of `bookings`, so the board selects it and filters on it in the same query as the bookings
-- (no query per row):
--   board_flight_alert(booking)  'delayed' or 'early' when the linked flight is 15 minutes or more
--                                off its scheduled arrival, else NULL (also NULL with no flight).
--                                The offset is the same as getFlightOffsetMinutes() in
--                                src/lib/flights/flight-timing.ts: actual or estimated arrival
--                                against scheduled; the stored delay_minutes only when there is
--                                no estimate. The threshold is ALERT_THRESHOLD_MINUTES there.
--   board_priority(booking)      'urgent' when the booking is overdue (booking_is_overdue(), see
--                                20261122090000_booking_step_deadlines.sql), 'high' when its flight
--                                is early or delayed, else 'normal'. Worked out when read, not stored.
--   board_step_since(booking)    when the booking reached its current step: the time of its latest
--                                'created' or 'status_changed' event (the step history).
--
-- All three are SECURITY INVOKER with an empty search_path: they read flights and booking_events
-- as the caller, so row-level security decides what they see. They change no data.

create function public.board_flight_alert(b public.bookings)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when o.offset_minutes >= 15 then 'delayed'
    when o.offset_minutes <= -15 then 'early'
  end
  from (
    select case
      when coalesce(f.actual_arrival_at, f.estimated_arrival_at) is not null
        then round(extract(epoch from (coalesce(f.actual_arrival_at, f.estimated_arrival_at) - f.scheduled_arrival_at)) / 60)::integer
      else f.delay_minutes
    end as offset_minutes
    from public.flights f
    where f.id = b.flight_id
  ) o;
$$;

create function public.board_priority(b public.bookings)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when public.booking_is_overdue(b.status, b.pickup_at) then 'urgent'
    when public.board_flight_alert(b) is not null then 'high'
    else 'normal'
  end;
$$;

create function public.board_step_since(b public.bookings)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select max(e.created_at)
  from public.booking_events e
  where e.booking_id = b.id
    and e.metadata ->> 'event_type' in ('created', 'status_changed');
$$;

revoke execute on function public.board_flight_alert(public.bookings) from public;
revoke execute on function public.board_flight_alert(public.bookings) from anon;
grant execute on function public.board_flight_alert(public.bookings) to authenticated;

revoke execute on function public.board_priority(public.bookings) from public;
revoke execute on function public.board_priority(public.bookings) from anon;
grant execute on function public.board_priority(public.bookings) to authenticated;

revoke execute on function public.board_step_since(public.bookings) from public;
revoke execute on function public.board_step_since(public.bookings) from anon;
grant execute on function public.board_step_since(public.bookings) to authenticated;

-- Rollback (run manually against the target database if needed):
-- drop function if exists public.board_step_since(public.bookings);
-- drop function if exists public.board_priority(public.bookings);
-- drop function if exists public.board_flight_alert(public.bookings);
