-- FO-F06-S03: photo access follows the scope of the booking.
--
-- Before, only admin and operations manager read or added photos. Now a photo can be read by whoever can
-- read its booking, and added by the technician the booking is assigned to:
--   - read (table and private bucket): the same rows bookings RLS lets the user see, so admin and
--     operations manager read all, a partner user reads only its own partner, a technician reads only the
--     bookings it can read. A photo of another partner's booking returns no row and no file.
--   - add to the bucket: admin and operations manager as before, and the technician assigned to the
--     booking (bookings.assigned_technician_id). The booking is the first folder of the path.
--   - record_booking_photo(): the same signature and checks. The assigned technician may call it. Any
--     other caller, including a technician on a booking that is not theirs or does not exist, gets 42501,
--     so a technician learns nothing about other bookings.
--
-- Nobody gains a write path to booking_photos: rows still come only from the function.
-- The policies compare the folder as text, so a path that is not a uuid never raises a cast error.

-- -----------------------------------------------------------------------------
-- Read: follow the booking
-- -----------------------------------------------------------------------------
create policy "booking_photos_select_booking_scope"
  on public.booking_photos for select
  to authenticated
  using (
    exists (select 1 from public.bookings b where b.id = booking_photos.booking_id)
  );

create policy "booking_photos_select_booking_scope"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'booking-photos'
    and exists (
      select 1 from public.bookings b where b.id::text = (storage.foldername(name))[1]
    )
  );

-- -----------------------------------------------------------------------------
-- Add: the assigned technician
-- -----------------------------------------------------------------------------
create policy "booking_photos_insert_assigned_technician"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'booking-photos'
    and (select public.current_user_role()) = 'technician'
    and exists (
      select 1
        from public.bookings b
       where b.id::text = (storage.foldername(name))[1]
         and b.assigned_technician_id = (select auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- record_booking_photo(): admin, operations manager or the assigned technician
-- -----------------------------------------------------------------------------
create or replace function public.record_booking_photo(
  p_booking_id uuid,
  p_type text,
  p_path text,
  p_caption text
)
returns public.booking_photos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_caption text := nullif(btrim(p_caption), '');
  v_content_type text;
  v_record public.booking_photos;
begin
  if v_user is null
     or not (
       coalesce(public.is_admin_or_ops_manager(), false)
       or coalesce(public.is_assigned_technician_of_booking(p_booking_id), false)
     ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if not exists (select 1 from public.bookings b where b.id = p_booking_id) then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if p_type is null or p_type not in ('installation', 'return', 'incident') then
    raise exception 'The photo type is not valid' using errcode = '22023';
  end if;

  if p_path is null
     or left(p_path, length(p_booking_id::text || '/' || p_type || '/')) <> p_booking_id::text || '/' || p_type || '/'
     or position('..' in p_path) > 0
     or not exists (
       select 1 from storage.objects o where o.bucket_id = 'booking-photos' and o.name = p_path
     ) then
    raise exception 'A photo is required' using errcode = '22023';
  end if;

  if char_length(v_caption) > 200 then
    raise exception 'The caption must be at most 200 characters' using errcode = '22023';
  end if;

  select coalesce(
    o.metadata ->> 'mimetype',
    case when lower(p_path) like '%.png' then 'image/png' else 'image/jpeg' end
  )
  into v_content_type
  from storage.objects o
  where o.bucket_id = 'booking-photos' and o.name = p_path;

  insert into public.booking_photos (booking_id, type, storage_path, content_type, caption, uploaded_by)
  values (p_booking_id, p_type, p_path, v_content_type, v_caption, v_user)
  returning * into v_record;

  return v_record;
end;
$$;

-- Rollback (run manually against the target database if needed): put back the function of
-- 20261228090000_booking_photo_content_type.sql, then:
-- drop policy if exists "booking_photos_insert_assigned_technician" on storage.objects;
-- drop policy if exists "booking_photos_select_booking_scope" on storage.objects;
-- drop policy if exists "booking_photos_select_booking_scope" on public.booking_photos;
