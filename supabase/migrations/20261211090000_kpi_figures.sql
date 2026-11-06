-- VI-F05-T02: the KPI and Command Centre figures, read by the screens, the export and the assistant.
--
-- Three functions, all SECURITY INVOKER with an empty search_path: they read bookings, flights,
-- airports, installations and technician_jobs as the caller, so row-level security decides which
-- rows are counted (a partner user counts only the rows of their own partner). They change no data.
--
--   kpi_today_figures(p_now)           Arrivals today and Installations due, counted per airport day.
--   kpi_correct_seat_figures(from, to) Completed bookings, with the result of the seat scan, matched.
--   kpi_on_time_readiness_figures(from, to)
--                                      Family Ready bookings, with a stored deadline, on time.
--
-- "Today" is the calendar day of p_now in the time zone of the airport of the booking.
--
-- Arrivals today: a booking that is not cancelled, whose arrival falls today. The arrival is the
--   estimated arrival of the linked flight (the scheduled one while there is no estimate), or the
--   pickup time when no flight is linked.
-- Installations due: a booking with pickup today (not cancelled, not a no-show) and no installation
--   record on any of its jobs.
--
-- The two rate functions return counts, not percentages, so the caller can say "No data" (nothing
-- to count) and "Not available" (nothing stored to compare) instead of showing 0%. A row whose input
-- is not stored is left out of the rate and is reported in the second count; it is not a failure.
-- Rows from before kpi_formula_inputs keep empty inputs and are never guessed.
--
-- Completed bookings for the seat figure: the rental is over (returned, cleaning, inspection or
-- completed) and the return time falls in [p_from, p_to). Family Ready bookings: family_ready_at
-- falls in [p_from, p_to). The deadline is the one of the installation job of the booking (the
-- latest job that is not cancelled).

create function public.kpi_today_figures(p_now timestamptz default now())
returns table (arrivals_today bigint, installations_due bigint)
language sql
stable
set search_path = ''
as $$
  select
    count(*) filter (
      where b.status <> 'cancelled'
        and (
          (case when f.id is not null then coalesce(f.estimated_arrival_at, f.scheduled_arrival_at) else b.pickup_at end)
          at time zone a.timezone
        )::date = (p_now at time zone a.timezone)::date
    ),
    count(*) filter (
      where b.status not in ('cancelled', 'no_show')
        and (b.pickup_at at time zone a.timezone)::date = (p_now at time zone a.timezone)::date
        and not exists (
          select 1
            from public.installations i
            join public.technician_jobs tj on tj.id = i.technician_job_id
           where tj.booking_id = b.id
        )
    )
  from public.bookings b
  join public.airports a on a.id = b.airport_id
  left join public.flights f on f.id = b.flight_id
  -- A window of two days each side holds any airport day (the largest offset is 14 hours), so the
  -- bookings of other days are not read or converted.
  where (b.pickup_at >= p_now - interval '2 days' and b.pickup_at < p_now + interval '2 days')
     or (f.id is not null
         and coalesce(f.estimated_arrival_at, f.scheduled_arrival_at) >= p_now - interval '2 days'
         and coalesce(f.estimated_arrival_at, f.scheduled_arrival_at) < p_now + interval '2 days');
$$;

create function public.kpi_correct_seat_figures(p_from timestamptz, p_to timestamptz)
returns table (completed_bookings bigint, with_result bigint, matched bigint)
language sql
stable
set search_path = ''
as $$
  select
    count(*),
    count(r.seat_match),
    count(*) filter (where r.seat_match)
  from (
    select (
      select i.seat_match
        from public.installations i
        join public.technician_jobs tj on tj.id = i.technician_job_id
       where tj.booking_id = b.id
         and tj.job_type = 'installation'
       order by i.created_at desc, i.id desc
       limit 1
    ) as seat_match
    from public.bookings b
    where b.status in ('returned', 'cleaning', 'inspection', 'completed')
      and b.return_at >= p_from
      and b.return_at < p_to
  ) r;
$$;

create function public.kpi_on_time_readiness_figures(p_from timestamptz, p_to timestamptz)
returns table (family_ready_bookings bigint, with_deadline bigint, on_time bigint)
language sql
stable
set search_path = ''
as $$
  select
    count(*),
    count(r.deadline_at),
    count(*) filter (where r.family_ready_at <= r.deadline_at)
  from (
    select b.family_ready_at, (
      select tj.deadline_at
        from public.technician_jobs tj
       where tj.booking_id = b.id
         and tj.job_type = 'installation'
         and tj.status <> 'cancelled'
       order by tj.created_at desc, tj.id desc
       limit 1
    ) as deadline_at
    from public.bookings b
    where b.family_ready_at >= p_from
      and b.family_ready_at < p_to
  ) r;
$$;

revoke execute on function public.kpi_today_figures(timestamptz) from public, anon;
revoke execute on function public.kpi_correct_seat_figures(timestamptz, timestamptz) from public, anon;
revoke execute on function public.kpi_on_time_readiness_figures(timestamptz, timestamptz) from public, anon;
grant execute on function public.kpi_today_figures(timestamptz) to authenticated;
grant execute on function public.kpi_correct_seat_figures(timestamptz, timestamptz) to authenticated;
grant execute on function public.kpi_on_time_readiness_figures(timestamptz, timestamptz) to authenticated;

-- Rollback (run manually against the target database if needed):
-- drop function if exists public.kpi_on_time_readiness_figures(timestamptz, timestamptz);
-- drop function if exists public.kpi_correct_seat_figures(timestamptz, timestamptz);
-- drop function if exists public.kpi_today_figures(timestamptz);
