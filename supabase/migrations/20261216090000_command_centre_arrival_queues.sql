-- VI-F11-S02: the Command Centre lists today's arrivals and the upcoming bookings (spec VI-F11 R1).
--
-- The function is SECURITY INVOKER (the default) and creates no table, so the RLS of bookings, airports
-- and flights is the scope: admin and operations see every booking, a technician or a partner user only
-- the rows their policies allow. Nothing in the function widens a scope.
--
-- Today's arrivals use the rule of the Arrivals today tile (kpi_today_figures): the booking is not
-- cancelled and its arrival falls on the calendar day of p_now at its airport. The arrival is the flight's
-- estimated (else scheduled) arrival, or the pickup when the booking has no flight. Upcoming bookings are
-- the bookings that arrive after that day and are neither cancelled nor no-show.
--
-- Each queue returns at most 5 rows. Arrivals put the early flights first (15 minutes or more before the
-- schedule: ALERT_THRESHOLD_MINUTES in src/lib/flights/flight-timing.ts, the threshold of the banners), then the earliest arrival (spec VI-F11 R15).
--
-- Rollback: drop function public.command_centre_arrival_queues(timestamptz);

create function public.command_centre_arrival_queues(p_now timestamptz default now())
returns table (
  queue text,
  booking_id uuid,
  booking_number text,
  status text,
  expected_at timestamptz,
  timezone text
)
language sql
stable
set search_path = ''
as $$
  with candidates as (
    select
      b.id,
      b.booking_number,
      b.status::text as status,
      a.timezone,
      case when f.id is not null then coalesce(f.estimated_arrival_at, f.scheduled_arrival_at) else b.pickup_at end
        as expected_at,
      coalesce(
        f.id is not null
          and coalesce(f.actual_arrival_at, f.estimated_arrival_at) <= f.scheduled_arrival_at - interval '15 minutes',
        false
      ) as is_early,
      (p_now at time zone a.timezone)::date as today
    from public.bookings b
    join public.airports a on a.id = b.airport_id
    left join public.flights f on f.id = b.flight_id
    where b.status not in ('cancelled', 'no_show')
      and (b.pickup_at >= p_now - interval '2 days'
           or (f.id is not null and coalesce(f.estimated_arrival_at, f.scheduled_arrival_at) >= p_now - interval '2 days'))
  ),
  ranked as (
    select
      c.*,
      case
        when (c.expected_at at time zone c.timezone)::date = c.today then 'arrivals'
        when (c.expected_at at time zone c.timezone)::date > c.today then 'upcoming'
      end as queue
    from candidates c
  ),
  numbered as (
    select
      r.*,
      row_number() over (
        partition by r.queue
        order by (r.queue = 'arrivals' and r.is_early) desc, r.expected_at, r.booking_number
      ) as position
    from ranked r
    where r.queue is not null
  )
  select n.queue, n.id, n.booking_number, n.status, n.expected_at, n.timezone
  from numbered n
  where n.position <= 5
  order by n.queue, n.position;
$$;

revoke execute on function public.command_centre_arrival_queues(timestamptz) from public, anon;
grant execute on function public.command_centre_arrival_queues(timestamptz) to authenticated;
