-- VI-F02-S06: handle cancelled or diverted flights (spec VI-F02 R10, Q5).
--
-- board_flight_alert(booking) now says 'cancelled' or 'diverted' when the linked flight has that status. The status
-- comes before the time gap: a cancelled flight can still hold an old estimate, and that estimate is not read as early
-- or late. The alert is not stored; the screens work it out each time from the flight (as for VI-F02-S04), so the flag
-- is gone when the flight is no longer cancelled or diverted.
--
-- The priority does not change (Q5): board_priority() raises it to High only for 'early', so a cancelled or diverted
-- flight stays Normal (an overdue booking is still Urgent). The flight_alert filter of the Workflow Board accepts
-- 'early' and 'delayed' only, so it is not affected.
--
-- The function stays SECURITY INVOKER: it reads flights as the caller, so row-level security decides what is seen.
-- No table, policy or grant changes.
--
-- Rollback: restore the function from its definition in 20261123090000_workflow_board_reads.sql, by running its
-- create statement as create or replace function public.board_flight_alert.

create or replace function public.board_flight_alert(b public.bookings)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when o.status in ('cancelled', 'diverted') then o.status::text
    when o.offset_minutes >= 15 then 'delayed'
    when o.offset_minutes <= -15 then 'early'
  end
  from (
    select f.status,
           case
             when coalesce(f.actual_arrival_at, f.estimated_arrival_at) is not null
               then round(extract(epoch from (coalesce(f.actual_arrival_at, f.estimated_arrival_at) - f.scheduled_arrival_at)) / 60)::integer
             else f.delay_minutes
           end as offset_minutes
    from public.flights f
    where f.id = b.flight_id
  ) o;
$$;
