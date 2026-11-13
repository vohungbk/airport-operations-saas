-- VI-F11-S04: the Command Centre lists the active rentals and the returned seats, each with a count and its
-- next item (spec VI-F11 R3).
--
-- The function is SECURITY INVOKER (the default) and creates no table, so the RLS of bookings and
-- seat_categories is the scope: admin and operations see every row, a technician or a partner user only the
-- rows their policies allow. Nothing in the function widens a scope.
--
-- One row comes back for each queue that has at least one item: its total and its next item. A queue with
-- nothing in it returns no row, and the caller shows a count of 0.
--   active    bookings in the Active Rental status (in_progress). Next: the earliest pickup.
--   returned  bookings in the Returned status. Next: the one waiting longest since its last change.
--
-- Rollback: drop function public.command_centre_active_returned();

create function public.command_centre_active_returned()
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
  with listed as (
    select
      case b.status when 'in_progress' then 'active' else 'returned' end as queue,
      b.id as item_id,
      b.booking_number as title,
      c.name as detail,
      b.status::text as status,
      row_number() over (
        partition by b.status
        order by
          case b.status when 'in_progress' then b.pickup_at else b.updated_at end,
          b.booking_number
      ) as position,
      count(*) over (partition by b.status) as total
    from public.bookings b
    join public.seat_categories c on c.id = b.seat_category_id
    where b.status in ('in_progress', 'returned')
  )
  select l.queue, l.total, l.item_id, l.title, l.detail, l.status
  from listed l
  where l.position = 1;
$$;

revoke execute on function public.command_centre_active_returned() from public, anon;
grant execute on function public.command_centre_active_returned() to authenticated;
