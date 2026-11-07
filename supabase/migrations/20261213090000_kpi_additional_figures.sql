-- VI-F05-S02: the figures of the additional KPIs of the KPI dashboard (spec R2).
--
--   kpi_additional_figures(from, to)       Counts and sums of the completed bookings: rental duration, replacements,
--                                          refunds, installation time and preparation time. SECURITY INVOKER.
--   kpi_seat_inventory_figures(from, to)   Seats in service, seats available and available seat-days. SECURITY DEFINER.
--
-- Two KPIs need no function: Monthly partner revenue is the figure of Commercial performance (the same
-- value on both tiles, spec E6), and Complaints has no record to read (spec Q3 is open).
--
-- The set of bookings is the one of the core KPIs (kpi_core_figures): the rental is over (returned,
-- cleaning, inspection or completed) and the return time falls in [p_from, p_to).
--
-- kpi_additional_figures reads bookings, booking_events, booking_adjustments and technician_jobs as the
-- caller, so row-level security decides which rows are counted: a partner user counts only the rows of
-- their own partner. It changes no data.
--   rented_days       Days of the rental inside the period: from the later of pickup and p_from to the return.
--   paid_days         Sum of bookings.paid_days.
--   replacements      Seat changes on these bookings from one seat to another (a first assignment, or a seat
--                     taken off with none put in its place, is not a replacement).
--   refund_amount     Sum of the partial and full refunds recorded on these bookings, and refunded_bookings
--                     the bookings that have at least one.
--   installation_*    Completed installation jobs of these bookings; the timed ones have a start and a
--                     completion (a job without a start is left out of the average, not counted as 0).
--   preparation_*     Bookings of these that reached Ready; the timed ones also have a Preparation step
--                     before it. The time is from the first move to Preparation to the first move to Ready.
--
-- kpi_seat_inventory_figures is the one function that does not use the caller's row access: the seats of
-- a partner are only the ones on its own bookings, but the stock of seats of the airport is the same for
-- every partner (design: "Available seats at DXB"). It returns four numbers and a list of airport codes,
-- never a seat row, and it refuses any caller who is not an active admin, operations manager or partner
-- user. A seat is in service from its purchase date until it is retired; a seat in quarantine is in
-- service but not available.

create function public.kpi_additional_figures(p_from timestamptz, p_to timestamptz)
returns table (
  completed_bookings bigint,
  paid_days bigint,
  rented_days numeric,
  replacements bigint,
  refund_amount numeric,
  refunded_bookings bigint,
  installation_jobs bigint,
  installation_timed bigint,
  installation_minutes numeric,
  prepared_bookings bigint,
  preparation_timed bigint,
  preparation_minutes numeric
)
language sql
stable
set search_path = ''
as $$
  with done as (
    select b.id, b.paid_days, b.pickup_at, b.return_at
      from public.bookings b
     where b.status in ('returned', 'cleaning', 'inspection', 'completed')
       and b.return_at >= p_from
       and b.return_at < p_to
  ),
  installs as (
    select tj.started_at, tj.completed_at
      from public.technician_jobs tj
     where tj.booking_id in (select d.id from done d)
       and tj.job_type = 'installation'
       and tj.status = 'completed'
  ),
  steps as (
    select e.booking_id,
           min(e.created_at) filter (where e.to_status = 'preparation') as preparation_at,
           min(e.created_at) filter (where e.to_status = 'ready') as ready_at
      from public.booking_events e
     where e.booking_id in (select d.id from done d)
       and e.metadata ->> 'event_type' = 'status_changed'
       and e.to_status in ('preparation', 'ready')
     group by e.booking_id
  ),
  refunds as (
    select a.booking_id, sum(a.amount) as amount
      from public.booking_adjustments a
     where a.booking_id in (select d.id from done d)
       and a.type in ('partial_refund', 'full_refund')
     group by a.booking_id
  )
  select
    (select count(*) from done),
    (select coalesce(sum(d.paid_days), 0) from done d),
    (select coalesce(sum(greatest(extract(epoch from (d.return_at - greatest(d.pickup_at, p_from))) / 86400, 0)), 0) from done d),
    (select count(*)
       from public.booking_events e
      where e.booking_id in (select d.id from done d)
        and e.metadata ->> 'event_type' = 'seat_changed'
        and e.metadata ->> 'from_seat_id' is not null
        and e.metadata ->> 'to_seat_id' is not null),
    (select coalesce(sum(r.amount), 0) from refunds r),
    (select count(*) from refunds),
    (select count(*) from installs),
    (select count(*) from installs i where i.started_at is not null and i.completed_at >= i.started_at),
    (select coalesce(sum(extract(epoch from (i.completed_at - i.started_at)) / 60), 0)
       from installs i where i.started_at is not null and i.completed_at >= i.started_at),
    (select count(*) from steps s where s.ready_at is not null),
    (select count(*) from steps s where s.ready_at is not null and s.preparation_at is not null and s.ready_at >= s.preparation_at),
    (select coalesce(sum(extract(epoch from (s.ready_at - s.preparation_at)) / 60), 0)
       from steps s where s.ready_at is not null and s.preparation_at is not null and s.ready_at >= s.preparation_at);
$$;

create function public.kpi_seat_inventory_figures(p_from timestamptz, p_to timestamptz)
returns table (
  seats_in_service bigint,
  available_seats bigint,
  available_seat_days numeric,
  airport_codes text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() is null
     or public.current_user_role() not in ('admin', 'operations_manager', 'partner_user') then
    raise exception 'Not allowed to read the seat inventory figures' using errcode = '42501';
  end if;

  return query
  select
    count(*) filter (where s.status <> 'retired' and s.retired_at is null),
    count(*) filter (where s.status = 'available'),
    coalesce(sum(greatest(extract(epoch from (
      least(p_to, now(), coalesce(s.retired_at, 'infinity'::timestamptz)) - greatest(p_from, s.purchase_date::timestamptz)
    )) / 86400, 0)), 0),
    coalesce(string_agg(distinct a.code, ', ' order by a.code) filter (where s.status <> 'retired' and s.retired_at is null), '')
  from public.seats s
  join public.airports a on a.id = s.airport_id;
end;
$$;

revoke execute on function public.kpi_additional_figures(timestamptz, timestamptz) from public, anon;
revoke execute on function public.kpi_seat_inventory_figures(timestamptz, timestamptz) from public, anon;
grant execute on function public.kpi_additional_figures(timestamptz, timestamptz) to authenticated;
grant execute on function public.kpi_seat_inventory_figures(timestamptz, timestamptz) to authenticated;

comment on function public.kpi_seat_inventory_figures(timestamptz, timestamptz) is
  'Active admin, operations manager or partner user. Counts the seats of every airport and returns four aggregates, never a seat row (VI-F05-S02).';

-- Rollback (run manually against the target database if needed):
-- drop function if exists public.kpi_seat_inventory_figures(timestamptz, timestamptz);
-- drop function if exists public.kpi_additional_figures(timestamptz, timestamptz);
