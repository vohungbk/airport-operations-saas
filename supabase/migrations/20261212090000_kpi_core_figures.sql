-- VI-F05-S01: the three core KPIs that had no formula yet (the other two are kpi_correct_seat_figures
-- and kpi_on_time_readiness_figures of VI-F05-T02).
--
--   kpi_traceability_figures(from, to)  Cleaning / inspection traceability
--   kpi_incident_figures(from, to)      Operational incidents
--   kpi_commercial_figures(from, to)    Commercial performance (partner revenue share)
--
-- All three are SECURITY INVOKER with an empty search_path, like the functions of VI-F05-T02: they read
-- bookings, cleaning_records, inspection_records and incidents as the caller, so row-level security
-- decides which rows are counted (a partner user counts only the rows of their own partner). They
-- change no data.
--
-- The set of bookings is the one of kpi_correct_seat_figures: the rental is over (returned, cleaning,
-- inspection or completed) and the return time falls in [p_from, p_to).
--
-- Traceability: of those bookings, the ones that have both a cleaning record and an inspection record.
--   A booking without one of them is a gap, not an unknown: it counts in the first number only.
-- Incidents: the incidents linked to those bookings, and the bookings, so the screen can say how many
--   incidents there are per completed rental.
-- Commercial performance: the sum of partner_share of those bookings. A booking whose share is not
--   calculated (partner_share is null) is left out of the sum and reported in with_revenue; it is not
--   counted as 0.

-- Each function picks the bookings once and counts the records with IN (subquery), so the planner can
-- hash the records instead of reading them again for every booking.

create function public.kpi_traceability_figures(p_from timestamptz, p_to timestamptz)
returns table (completed_bookings bigint, traced_bookings bigint)
language sql
stable
set search_path = ''
as $$
  with done as (
    select b.id
      from public.bookings b
     where b.status in ('returned', 'cleaning', 'inspection', 'completed')
       and b.return_at >= p_from
       and b.return_at < p_to
  )
  select
    (select count(*) from done),
    (select count(*)
       from done d
      where d.id in (select c.booking_id from public.cleaning_records c)
        and d.id in (select i.booking_id from public.inspection_records i));
$$;

create function public.kpi_incident_figures(p_from timestamptz, p_to timestamptz)
returns table (completed_bookings bigint, incidents bigint)
language sql
stable
set search_path = ''
as $$
  with done as (
    select b.id
      from public.bookings b
     where b.status in ('returned', 'cleaning', 'inspection', 'completed')
       and b.return_at >= p_from
       and b.return_at < p_to
  )
  select
    (select count(*) from done),
    (select count(*) from public.incidents n where n.booking_id in (select d.id from done d));
$$;

create function public.kpi_commercial_figures(p_from timestamptz, p_to timestamptz)
returns table (completed_bookings bigint, with_revenue bigint, partner_revenue numeric)
language sql
stable
set search_path = ''
as $$
  select
    count(*),
    count(b.partner_share),
    coalesce(sum(b.partner_share), 0)
  from public.bookings b
  where b.status in ('returned', 'cleaning', 'inspection', 'completed')
    and b.return_at >= p_from
    and b.return_at < p_to;
$$;

revoke execute on function public.kpi_traceability_figures(timestamptz, timestamptz) from public, anon;
revoke execute on function public.kpi_incident_figures(timestamptz, timestamptz) from public, anon;
revoke execute on function public.kpi_commercial_figures(timestamptz, timestamptz) from public, anon;
grant execute on function public.kpi_traceability_figures(timestamptz, timestamptz) to authenticated;
grant execute on function public.kpi_incident_figures(timestamptz, timestamptz) to authenticated;
grant execute on function public.kpi_commercial_figures(timestamptz, timestamptz) to authenticated;

-- Rollback (run manually against the target database if needed):
-- drop function if exists public.kpi_commercial_figures(timestamptz, timestamptz);
-- drop function if exists public.kpi_incident_figures(timestamptz, timestamptz);
-- drop function if exists public.kpi_traceability_figures(timestamptz, timestamptz);
