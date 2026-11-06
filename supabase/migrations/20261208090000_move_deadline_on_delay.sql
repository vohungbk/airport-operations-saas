-- VI-F02-S05: move the deadline on delay (spec VI-F02 R9, Q3).
--
-- installation_job_deadline(): a flight that is 15 minutes or more LATE moves the installation deadline later by the
-- same number of minutes. A delay under 15 minutes moves nothing: the deadline stays at the base, 60 minutes before the
-- pickup time (PRD 20.5). It added any delay, even 5 minutes, before. The early rule (VI-F02-S04) is not changed.
--
-- The gap is read as the screens and board_flight_alert() read it: the actual or else the estimated arrival against the
-- scheduled arrival, and delay_minutes only when there is neither. The minutes are rounded the same way, so the alert
-- and the deadline agree on what "15 minutes late" is. The deadline is still counted from the pickup time, so when the
-- estimate comes back under 15 minutes the deadline is the base one again.
--
-- The triggers that call this function already run when the flight or the pickup time changes; jobs of flights that do
-- not change are not touched and nothing is back-filled. No table, policy or grant changes.
--
-- Rollback: restore the function from its previous definition, 20261205090000_early_arrival_priority_deadline.sql,
-- by running its create or replace function public.installation_job_deadline statement.

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
                       -- early or late by 15 minutes or more: the deadline moves by the same minutes
                       when abs(round(extract(epoch from g.gap) / 60)) >= 15
                         then make_interval(mins => round(extract(epoch from g.gap) / 60)::integer)
                       -- less than 15 minutes either way: no move
                       else interval '0'
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
