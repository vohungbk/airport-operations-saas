-- CO-F07-S04, S05: confirm a booking import, reject duplicate rows, record where a booking came from.
--
-- * booking_imports: one row per confirmed import (the data of "Import history", CO-F07-S07). Rows are
--   written only by import_bookings(); no role can insert, update or delete one, so the history of an
--   import is never changed or deleted. RLS is on from creation: an admin and an operations manager read
--   every import, a partner user and a technician read none.
-- * bookings.import_id: the import that created a booking (null for a booking made by hand).
-- * record_booking_event(): the "created" event now carries metadata.source ('manual' by default, 'csv'
--   inside import_bookings(), 'webhook' for a later story) and metadata.import_id. The rest of the
--   function is the body of 20261002070734 unchanged.
-- * import_bookings(): creates the valid rows of an import in ONE transaction, each through
--   create_booking(), so a row is held to the same rules as a booking typed by hand. A row whose
--   external booking number the partner already has is rejected as a duplicate and the existing booking
--   is not touched (R9, E4). Imports of one partner are serialized by a transaction lock, so two imports
--   of the same file at the same time cannot both create a row. A unique index is not used: bookings
--   made before this migration may already repeat a number, and an index would fail on them.
--   SECURITY DEFINER because no policy lets a user insert into booking_imports; the role is checked here.
--
-- Rollback:
--   drop function if exists public.import_bookings(uuid, uuid, text, bigint, integer, jsonb);
--   alter table public.bookings drop column import_id;
--   drop table public.booking_imports;
--   (and restore record_booking_event() from 20261002070734_booking_numbering_event_log_and_guards.sql)

create table public.booking_imports (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  airport_id uuid not null references public.airports(id) on delete restrict,
  file_name text not null check (btrim(file_name) <> '' and char_length(file_name) <= 255),
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  total_rows integer not null check (total_rows > 0),
  created_rows integer not null default 0 check (created_rows >= 0),
  rejected_rows integer not null default 0 check (rejected_rows >= 0),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index booking_imports_partner_id_idx on public.booking_imports (partner_id);
create index booking_imports_created_by_idx on public.booking_imports (created_by);
create index booking_imports_created_at_idx on public.booking_imports (created_at desc);

alter table public.booking_imports enable row level security;

create policy "booking_imports_select_admin_ops_manager"
  on public.booking_imports
  for select
  to authenticated
  using (coalesce(public.is_admin_or_ops_manager(), false));

alter table public.bookings
  add column import_id uuid references public.booking_imports(id) on delete restrict;

create index bookings_import_id_idx on public.bookings (import_id);

-- -----------------------------------------------------------------------------
-- The event log: the source of the booking goes in the "created" event.
-- -----------------------------------------------------------------------------
create or replace function public.record_booking_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_notes text := nullif(btrim(current_setting('app.booking_event_notes', true)), '');
  v_changes jsonb := '{}'::jsonb;
begin
  select u.id
    into v_user_id
    from public.users u
   where u.id = auth.uid();

  if tg_op = 'INSERT' then
    insert into public.booking_events (booking_id, seat_id, user_id, from_status, to_status, notes, metadata, created_at)
    values (
      new.id,
      new.assigned_seat_id,
      v_user_id,
      null,
      new.status,
      null,
      jsonb_build_object(
        'event_type', 'created',
        'booking_number', new.booking_number,
        'partner_id', new.partner_id,
        'assigned_seat_id', new.assigned_seat_id,
        'source', coalesce(nullif(btrim(current_setting('app.booking_source', true)), ''), 'manual'),
        'import_id', nullif(btrim(current_setting('app.booking_import_id', true)), '')
      ),
      clock_timestamp()
    );

    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.booking_events (booking_id, seat_id, user_id, from_status, to_status, notes, metadata, created_at)
    values (
      new.id,
      new.assigned_seat_id,
      v_user_id,
      old.status,
      new.status,
      v_notes,
      jsonb_build_object('event_type', 'status_changed'),
      clock_timestamp()
    );
  end if;

  if new.assigned_seat_id is distinct from old.assigned_seat_id then
    insert into public.booking_events (booking_id, seat_id, user_id, from_status, to_status, notes, metadata, created_at)
    values (
      new.id,
      new.assigned_seat_id,
      v_user_id,
      old.status,
      new.status,
      null,
      jsonb_build_object(
        'event_type', 'seat_changed',
        'from_seat_id', old.assigned_seat_id,
        'to_seat_id', new.assigned_seat_id
      ),
      clock_timestamp()
    );
  end if;

  if new.pickup_at is distinct from old.pickup_at then
    v_changes := v_changes || jsonb_build_object('pickup_at', jsonb_build_object('from', old.pickup_at, 'to', new.pickup_at));
  end if;
  if new.return_at is distinct from old.return_at then
    v_changes := v_changes || jsonb_build_object('return_at', jsonb_build_object('from', old.return_at, 'to', new.return_at));
  end if;
  if new.external_booking_number is distinct from old.external_booking_number then
    v_changes := v_changes || jsonb_build_object('external_booking_number', jsonb_build_object('from', old.external_booking_number, 'to', new.external_booking_number));
  end if;
  if new.child_age_band is distinct from old.child_age_band then
    v_changes := v_changes || jsonb_build_object('child_age_band', jsonb_build_object('from', old.child_age_band, 'to', new.child_age_band));
  end if;
  if new.child_height is distinct from old.child_height then
    v_changes := v_changes || jsonb_build_object('child_height', jsonb_build_object('from', old.child_height, 'to', new.child_height));
  end if;
  if new.vehicle is distinct from old.vehicle then
    v_changes := v_changes || jsonb_build_object('vehicle', jsonb_build_object('from', old.vehicle, 'to', new.vehicle));
  end if;
  if new.vehicle_bay is distinct from old.vehicle_bay then
    v_changes := v_changes || jsonb_build_object('vehicle_bay', jsonb_build_object('from', old.vehicle_bay, 'to', new.vehicle_bay));
  end if;
  if new.notes is distinct from old.notes then
    v_changes := v_changes || jsonb_build_object('notes', jsonb_build_object('from', old.notes, 'to', new.notes));
  end if;

  if v_changes <> '{}'::jsonb then
    -- to_status is NOT NULL, so an "updated" event repeats the current status.
    insert into public.booking_events (booking_id, seat_id, user_id, from_status, to_status, notes, metadata, created_at)
    values (
      new.id,
      new.assigned_seat_id,
      v_user_id,
      old.status,
      new.status,
      null,
      jsonb_build_object('event_type', 'updated', 'changes', v_changes),
      clock_timestamp()
    );
  end if;

  return null;
end;
$$;


-- -----------------------------------------------------------------------------
-- import_bookings(): p_rows is a JSON array, one object per row to create, with
--   row_number, seat_category_id, pickup_at, return_at, daily_rate and the optional
--   external_booking_number, child_age_band, vehicle, notes.
-- Answers {import_id, created: [{row_number, booking_id}], rejected: [{row_number, reason}]}.
-- -----------------------------------------------------------------------------
create function public.import_bookings(
  p_partner_id uuid,
  p_airport_id uuid,
  p_file_name text,
  p_file_size_bytes bigint,
  p_total_rows integer,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_import_id uuid;
  v_row jsonb;
  v_number integer;
  v_external text;
  v_booking public.bookings;
  v_created jsonb := '[]'::jsonb;
  v_rejected jsonb := '[]'::jsonb;
begin
  if not coalesce(public.is_admin_or_ops_manager(), false) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 1000 then
    raise exception 'An import holds 1 to 1000 rows' using errcode = '22023';
  end if;

  if p_total_rows is null or p_total_rows < jsonb_array_length(p_rows) then
    raise exception 'The total of rows is less than the rows to create' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('booking_import:' || p_partner_id::text, 0));

  insert into public.booking_imports (partner_id, airport_id, file_name, file_size_bytes, total_rows, created_by)
  values (p_partner_id, p_airport_id, btrim(p_file_name), p_file_size_bytes, p_total_rows, auth.uid())
  returning id into v_import_id;

  perform set_config('app.booking_source', 'csv', true);
  perform set_config('app.booking_import_id', v_import_id::text, true);

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_number := (v_row->>'row_number')::integer;
    v_external := nullif(btrim(v_row->>'external_booking_number'), '');

    if v_external is not null and exists (
      select 1 from public.bookings b
       where b.partner_id = p_partner_id and b.external_booking_number = v_external
    ) then
      v_rejected := v_rejected || jsonb_build_object('row_number', v_number, 'reason', 'Duplicate external booking number');
      continue;
    end if;

    begin
      select * into v_booking from public.create_booking(
        p_partner_id,
        p_airport_id,
        (v_row->>'seat_category_id')::uuid,
        (v_row->>'pickup_at')::timestamptz,
        (v_row->>'return_at')::timestamptz,
        (v_row->>'daily_rate')::numeric,
        null,
        v_external,
        nullif(btrim(v_row->>'child_age_band'), ''),
        null,
        nullif(btrim(v_row->>'vehicle'), ''),
        null,
        nullif(btrim(v_row->>'notes'), '')
      );

      update public.bookings set import_id = v_import_id where id = v_booking.id;

      v_created := v_created || jsonb_build_object('row_number', v_number, 'booking_id', v_booking.id);
    exception when others then
      v_rejected := v_rejected || jsonb_build_object('row_number', v_number, 'reason', sqlerrm);
    end;
  end loop;

  perform set_config('app.booking_source', '', true);
  perform set_config('app.booking_import_id', '', true);

  update public.booking_imports
     set created_rows = jsonb_array_length(v_created),
         rejected_rows = p_total_rows - jsonb_array_length(v_created)
   where id = v_import_id;

  return jsonb_build_object('import_id', v_import_id, 'created', v_created, 'rejected', v_rejected);
end;
$$;

revoke execute on function public.import_bookings(uuid, uuid, text, bigint, integer, jsonb) from public;
revoke execute on function public.import_bookings(uuid, uuid, text, bigint, integer, jsonb) from anon;
grant execute on function public.import_bookings(uuid, uuid, text, bigint, integer, jsonb) to authenticated;
