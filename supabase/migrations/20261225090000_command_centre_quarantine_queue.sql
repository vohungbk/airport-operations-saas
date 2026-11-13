-- VI-F11-S05: the Command Centre shows the seats that are damaged or in quarantine, with a count and the
-- next seat (spec VI-F11 R4). The cleaning and inspection queues come from
-- command_centre_allocation_queues() (VI-F11-S03).
--
-- No status or column records damage, so the queue counts the seats in the quarantine status.
--
-- The function is SECURITY INVOKER (the default) and creates no table, so the RLS of seats and
-- seat_categories is the scope. Nothing in the function widens a scope.
--
-- One row comes back when at least one seat is in quarantine: the total and the seat waiting longest since
-- its last change. With none, no row comes back and the caller shows a count of 0.
--
-- Rollback: drop function public.command_centre_quarantine_queue();

create function public.command_centre_quarantine_queue()
returns table (
  queue text,
  total bigint,
  item_id uuid,
  title text,
  detail text,
  status text
)
language sql
stable
set search_path = ''
as $$
  with quarantined as (
    select
      'quarantine'::text as queue,
      s.id as item_id,
      s.serial_number as title,
      c.name as detail,
      s.status::text as status,
      row_number() over (order by s.updated_at, s.serial_number) as position,
      count(*) over () as total
    from public.seats s
    join public.seat_categories c on c.id = s.category_id
    where s.status = 'quarantine'
  )
  select q.queue, q.total, q.item_id, q.title, q.detail, q.status
  from quarantined q
  where q.position = 1;
$$;

revoke execute on function public.command_centre_quarantine_queue() from public, anon;
grant execute on function public.command_centre_quarantine_queue() to authenticated;
