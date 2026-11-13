-- VI-F11-S03: the Command Centre shows the seats to allocate, the seats in preparation and the installations
-- due, each with a count and its next item (spec VI-F11 R2).
--
-- The function is SECURITY INVOKER (the default) and creates no table, so the RLS of bookings, seats,
-- technician_jobs and users is the scope: admin and operations see every row, a technician or a partner user
-- only the rows their policies allow. Nothing in the function widens a scope.
--
-- One row comes back for each queue that has at least one item: its total and its next item. A queue with
-- nothing in it returns no row, and the caller shows a count of 0.
--   allocation    bookings that still need a seat: not ended, not yet installed (the statuses of
--                 ACTIVE_BOOKING_STATUSES up to en_route), no assigned seat. Next: the earliest pickup.
--   installations installation jobs not finished (assigned or in progress). Next: the earliest deadline, a job
--                 with no deadline last. The technician name can be empty when RLS hides the user.
--   cleaning      seats in the cleaning status. Next: the one waiting longest.
--   inspection    seats in the inspection status. Next: the one waiting longest.
--
-- Rollback: drop function public.command_centre_allocation_queues();

create function public.command_centre_allocation_queues()
returns table (
  queue text,
  total bigint,
  item_id uuid,
  title text,
  detail text,
  status text,
  due_at timestamptz,
  timezone text
)
language sql
stable
set search_path = ''
as $$
  with allocation as (
    select
      'allocation'::text as queue,
      b.id as item_id,
      b.booking_number as title,
      c.name as detail,
      b.status::text as status,
      null::timestamptz as due_at,
      null::text as timezone,
      row_number() over (order by b.pickup_at, b.booking_number) as position,
      count(*) over () as total
    from public.bookings b
    join public.seat_categories c on c.id = b.seat_category_id
    where b.assigned_seat_id is null
      and b.status in ('pending', 'confirmed', 'preparation', 'ready', 'assigned', 'en_route')
  ),
  installations as (
    select
      'installations'::text as queue,
      j.id as item_id,
      coalesce(u.full_name, j.job_number) as title,
      coalesce(j.vehicle_bay, b.vehicle_bay) as detail,
      j.status::text as status,
      j.deadline_at as due_at,
      a.timezone as timezone,
      row_number() over (order by j.deadline_at nulls last, j.assigned_at, j.job_number) as position,
      count(*) over () as total
    from public.technician_jobs j
    join public.bookings b on b.id = j.booking_id
    join public.airports a on a.id = b.airport_id
    left join public.users u on u.id = j.technician_id
    where j.job_type = 'installation'
      and j.status in ('assigned', 'in_progress')
  ),
  preparing as (
    select
      case s.status when 'cleaning' then 'cleaning' else 'inspection' end as queue,
      s.id as item_id,
      s.serial_number as title,
      c.name as detail,
      s.status::text as status,
      null::timestamptz as due_at,
      null::text as timezone,
      row_number() over (partition by s.status order by s.updated_at, s.serial_number) as position,
      count(*) over (partition by s.status) as total
    from public.seats s
    join public.seat_categories c on c.id = s.category_id
    where s.status in ('cleaning', 'inspection')
  ),
  every_queue as (
    select * from allocation
    union all select * from installations
    union all select * from preparing
  )
  select e.queue, e.total, e.item_id, e.title, e.detail, e.status, e.due_at, e.timezone
  from every_queue e
  where e.position = 1;
$$;

revoke execute on function public.command_centre_allocation_queues() from public, anon;
grant execute on function public.command_centre_allocation_queues() to authenticated;
