-- FO-F06-S02: keep the file type of a booking photo.
--
-- booking_photos already holds the record (booking and type), the actor (uploaded_by), the time
-- (created_at) and the private storage path. This adds the file type (image/jpeg or image/png).
-- record_booking_photo() reads it from the file in the private bucket (the bucket only accepts those two
-- types); when the file carries none, it comes from the extension of the path.
--
-- Location data is removed from the image in the browser before the upload. The database cannot read the
-- bytes of a file, so a client that calls the API on its own can still send a file with location data.
--
-- The function keeps its signature and every earlier check.

alter table public.booking_photos add column content_type text;

update public.booking_photos p
set content_type = coalesce(
  (select o.metadata ->> 'mimetype' from storage.objects o where o.bucket_id = 'booking-photos' and o.name = p.storage_path),
  case when lower(p.storage_path) like '%.png' then 'image/png' else 'image/jpeg' end
);

alter table public.booking_photos
  alter column content_type set not null,
  add constraint booking_photos_content_type_check check (content_type in ('image/jpeg', 'image/png'));

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
  if v_user is null or not coalesce(public.is_admin_or_ops_manager(), false) then
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
-- 20261227090000_booking_photos.sql, then:
-- alter table public.booking_photos drop constraint if exists booking_photos_content_type_check;
-- alter table public.booking_photos drop column if exists content_type;
