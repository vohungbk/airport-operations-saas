-- Booking form seat picker: every seat of the airport and category with its state for the period.
--
-- The picker shows three kinds of row (UI-F06-T02): Available, Conflict (with the number of the
-- booking that holds the seat) and Not usable (with the reason). get_available_seats() only returns
-- the first kind and stays as it is; the create and update checks still use their own assertion.
--
-- The function is SECURITY INVOKER and creates no table, so the RLS of seats and bookings is the
-- scope. It returns nothing to a caller who is not an admin or operations manager. Retired seats are
-- not listed. p_exclude_booking_id keeps the booking's own seat available while editing.
--
-- Rollback: drop function public.get_booking_seat_options(uuid, uuid, timestamptz, timestamptz, uuid);

create function public.get_booking_seat_options(
  p_airport_id uuid,
  p_seat_category_id uuid,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_exclude_booking_id uuid default null
)
returns table (
  id uuid,
  serial_number text,
  availability text,
  conflict_booking_number text,
  unusable_reason text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id,
         s.serial_number,
         case
           when s.status <> 'available' then 'not_usable'
           when c.booking_number is not null then 'conflict'
           else 'available'
         end,
         case when s.status = 'available' then c.booking_number end,
         case
           when s.status <> 'available'
             then 'Seat status: ' || replace(s.status::text, '_', ' ')
         end
    from public.seats s
    left join lateral (
      select b.booking_number
        from public.bookings b
       where b.assigned_seat_id = s.id
         and b.id is distinct from p_exclude_booking_id
         and b.status in ('pending', 'confirmed', 'assigned', 'in_progress')
         and b.pickup_at < p_return_at
         and p_pickup_at < b.return_at
       order by b.pickup_at
       limit 1
    ) c on true
   where public.is_admin_or_ops_manager()
     and s.airport_id = p_airport_id
     and s.category_id = p_seat_category_id
     and s.status <> 'retired'
   order by s.serial_number;
$$;

revoke execute on function public.get_booking_seat_options(uuid, uuid, timestamptz, timestamptz, uuid) from public;
revoke execute on function public.get_booking_seat_options(uuid, uuid, timestamptz, timestamptz, uuid) from anon;
grant execute on function public.get_booking_seat_options(uuid, uuid, timestamptz, timestamptz, uuid) to authenticated;
