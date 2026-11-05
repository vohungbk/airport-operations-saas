-- VI-F02-S04: alert on early arrival (spec VI-F02 R8, E4, Q3, Q5).
--
-- The alert itself (ARRIVING 45 MINUTES EARLY) is not stored: the screens work it out each time from the flight
-- (flight-timing.ts, 15 minutes or more), so it is shown as soon as the flight changes and is gone when the estimate
-- moves back to the schedule (E4). This migration changes the two rules that sit in the database.
--
-- 1. board_priority(booking): High only when the flight arrives 15 minutes or more EARLY (Q5). A late flight stays
--    Normal; it moves the deadline (VI-F02-S05) but does not raise the priority. Urgent (an overdue booking) still comes
--    first. It was High for a late flight as well (CO-F08-T01); that is the line that changes.
--
-- 2. installation_job_deadline(): an early arrival of 15 minutes or more moves the installation deadline earlier by the
--    same number of minutes (Q3). An early arrival of less than 15 minutes moves nothing. The rule for a late flight is
--    not changed here (VI-F02-S05 owns it). The gap is read as the screens read it: the actual or else the estimated
--    arrival against the scheduled arrival, and delay_minutes (negative when early) only when there is neither; the
--    minutes are rounded the way board_flight_alert() rounds them, so the alert and the deadline agree on what "15
--    minutes early" is. The deadline is still counted from the pickup time, so when the estimate moves back to the
--    schedule the deadline is the base one again (AC04). The triggers that call this function already run when the
--    flight or the pickup time changes; jobs of flights that do not change are not touched and nothing is back-filled.
--
-- Rollback: restore both functions from their first definitions:
--   20261123090000_workflow_board_reads.sql (board_priority) and 20261127090000_kpi_formula_inputs.sql
--   (installation_job_deadline), by running their create statements as create or replace.

create or replace function public.board_priority(b public.bookings)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when public.booking_is_overdue(b.status, b.pickup_at) then 'urgent'
    when public.board_flight_alert(b) = 'early' then 'high'
    else 'normal'
  end;
$$;

create or replace function public.installation_job_deadline(p_pickup_at timestamptz, p_flight_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select p_pickup_at
         - interval '60 minutes'
         + coalesce(
             (select case
                       -- early by 15 minutes or more: the deadline moves earlier by the same minutes
                       when round(extract(epoch from g.gap) / 60) <= -15
                         then make_interval(mins => round(extract(epoch from g.gap) / 60)::integer)
                       -- late: as before (VI-F02-S05 owns the rule); early by less than 15 minutes adds nothing
                       else greatest(g.gap, interval '0')
                     end
                from (select case
                               when coalesce(f.actual_arrival_at, f.estimated_arrival_at) is not null
                                 then coalesce(f.actual_arrival_at, f.estimated_arrival_at) - f.scheduled_arrival_at
                               else make_interval(mins => coalesce(f.delay_minutes, 0))
                             end as gap
                        from public.flights f
                       where f.id = p_flight_id) g),
             interval '0'
           );
$$;
