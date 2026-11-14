-- FO-F06-S01: upload a photo to a booking.
--
-- booking_photos holds one row per photo of a booking: where it is stored, the caption, the type of
-- record it belongs to, who uploaded it and when. Rows are written only by record_booking_photo()
-- and are never changed or deleted.
--
-- The file itself goes straight from the browser to the private bucket booking-photos. The bucket
-- refuses anything that is not a JPG or PNG of at most 2 MB, and its policies let only admin and
-- operations manager add or read (technicians come with the screens of their jobs).
--
-- record_booking_photo(booking, type, path, caption):
--   - admin and operations_manager only; anyone else 42501.
--   - the booking must exist (P0002).
--   - the type must be installation, return or incident; the path must be <booking id>/<type>/<file>
--     and the file must already be in the bucket; the caption is at most 200 characters (22023).
--
-- SECURITY DEFINER with an empty search_path: the checks above are the access rule.

create table public.booking_photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  type text not null,
  storage_path text not null,
  caption text,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint booking_photos_type_check check (type in ('installation', 'return', 'incident')),
  constraint booking_photos_caption_check check (caption is null or char_length(caption) between 1 and 200),
  constraint booking_photos_storage_path_key unique (storage_path)
);

create index booking_photos_booking_id_idx on public.booking_photos (booking_id, created_at desc);

alter table public.booking_photos enable row level security;

-- Internal roles read every photo; partner users and technicians read none yet.
create policy "booking_photos_select_admin_ops_manager"
  on public.booking_photos for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

-- Photos are never changed or deleted, and rows come only from the function below.
revoke insert, update, delete, truncate on public.booking_photos from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Photos: a private bucket. Internal roles add and read; nobody changes or removes.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-photos', 'booking-photos', false, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "booking_photos_insert_admin_ops_manager"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'booking-photos' and (select public.is_admin_or_ops_manager()));

create policy "booking_photos_select_admin_ops_manager"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'booking-photos' and (select public.is_admin_or_ops_manager()));

-- -----------------------------------------------------------------------------
-- record_booking_photo()
-- -----------------------------------------------------------------------------
create function public.record_booking_photo(
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

  insert into public.booking_photos (booking_id, type, storage_path, caption, uploaded_by)
  values (p_booking_id, p_type, p_path, v_caption, v_user)
  returning * into v_record;

  return v_record;
end;
$$;

revoke execute on function public.record_booking_photo(uuid, text, text, text) from public;
revoke execute on function public.record_booking_photo(uuid, text, text, text) from anon;
grant execute on function public.record_booking_photo(uuid, text, text, text) to authenticated;

-- Rollback (run manually against the target database if needed):
-- drop function if exists public.record_booking_photo(uuid, text, text, text);
-- drop policy if exists "booking_photos_select_admin_ops_manager" on storage.objects;
-- drop policy if exists "booking_photos_insert_admin_ops_manager" on storage.objects;
-- delete from storage.buckets where id = 'booking-photos';
-- drop table if exists public.booking_photos;
