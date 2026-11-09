-- Technicians list: the airport, the open jobs and the jobs done this week of each technician on the page.
--
-- The function is SECURITY INVOKER (the default) and creates no table, so the RLS of technician_jobs,
-- bookings and airports is the scope. Nothing in the function widens a scope.
--
-- A technician has no airport of their own. The airport is the one of their most recently assigned job
-- (booking airport); it is null when the technician has no job yet. Open jobs are jobs that are assigned
-- or in progress. Jobs done this week are completed jobs whose completed_at falls on or after Monday
-- 00:00 UTC of the week of p_now.
--
-- Rollback: drop function public.technician_list_figures(uuid[], timestamptz);

create function public.technician_list_figures(
  p_technician_ids uuid[],
  p_now timestamptz default now()
)
returns table (
  technician_id uuid,
  airport_name text,
  airport_code text,
  open_jobs integer,
  jobs_done_this_week integer
)
language sql
stable
set search_path = ''
as $$
  select
    u.id,
    la.name,
    la.code,
    coalesce(c.open_jobs, 0)::integer,
    coalesce(c.done_this_week, 0)::integer
  from unnest(p_technician_ids) as u(id)
  left join lateral (
    select a.name, a.code
    from public.technician_jobs j
    join public.bookings b on b.id = j.booking_id
    join public.airports a on a.id = b.airport_id
    where j.technician_id = u.id
    order by j.assigned_at desc
    limit 1
  ) la on true
  left join lateral (
    select
      count(*) filter (where j.status in ('assigned', 'in_progress')) as open_jobs,
      count(*) filter (
        where j.status = 'completed'
          and j.completed_at >= (date_trunc('week', p_now at time zone 'UTC') at time zone 'UTC')
      ) as done_this_week
    from public.technician_jobs j
    where j.technician_id = u.id
  ) c on true;
$$;

revoke execute on function public.technician_list_figures(uuid[], timestamptz) from public, anon;
grant execute on function public.technician_list_figures(uuid[], timestamptz) to authenticated;
