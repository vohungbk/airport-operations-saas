-- F11: booking numbering, server-written booking_events, bookings guard.
--
-- Why: bookings need a DB-generated booking_number, an audit log that only
-- the server can write (and nobody can edit), and column-level protection
-- that RLS cannot express. Mutations go through the RPCs in the next
-- migration (20261002070738_booking_rpcs.sql).
--
-- Changes to existing RLS (intentional, see docs/security.md):
--   * DROPS booking_events_insert_admin_ops_manager and
--     booking_events_insert_technician. booking_events is now written only
--     by the SECURITY DEFINER trigger below. Future workflows (F15 technician
--     jobs) must write events through an RPC/trigger, not a direct INSERT.
--   * bookings and booking_events SELECT/INSERT/UPDATE policies are unchanged.

-- -----------------------------------------------------------------------------
-- booking_number: 'BK-' + 5-digit zero-padded sequence. Seed data uses
-- BK-00001..BK-00020, so the sequence starts at 21.
-- SECURITY DEFINER so callers need no direct sequence privilege; granting
-- execute only lets a caller burn a number (gaps are harmless).
-- -----------------------------------------------------------------------------
create sequence public.booking_number_seq start with 21 minvalue 1;

revoke all on sequence public.booking_number_seq from public;
revoke all on sequence public.booking_number_seq from anon;

create function public.generate_booking_number()
returns text
language sql
security definer
set search_path = ''
as $$
  select 'BK-' || lpad(nextval('public.booking_number_seq')::text, 5, '0');
$$;

revoke execute on function public.generate_booking_number() from public;
revoke execute on function public.generate_booking_number() from anon;
grant execute on function public.generate_booking_number() to authenticated;

-- -----------------------------------------------------------------------------
-- Event log trigger. SECURITY DEFINER so the row is written even though no
-- policy lets a user INSERT into booking_events. Runs only as a trigger.
-- metadata.event_type is one of: created, updated, status_changed,
-- seat_changed (booking_events has no event_type column).
-- user_id resolves through public.users (FK); an auth user without a profile
-- gets NULL. The status-change reason arrives via the transaction-local
-- setting app.booking_event_notes.
-- A single UPDATE can produce several events (status + seat + fields).
-- created_at uses clock_timestamp(), not now(): now() is the transaction
-- start time and would give every event of one transaction the same value.
-- Documented order within one UPDATE (oldest first): status_changed,
-- seat_changed, updated.
-- -----------------------------------------------------------------------------
create function public.record_booking_event()
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
        'assigned_seat_id', new.assigned_seat_id
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

revoke execute on function public.record_booking_event() from public;
revoke execute on function public.record_booking_event() from anon;

create trigger record_bookings_event_insert
  after insert on public.bookings
  for each row
  execute function public.record_booking_event();

create trigger record_bookings_event_update
  after update on public.bookings
  for each row
  when (
    old.status is distinct from new.status
    or old.assigned_seat_id is distinct from new.assigned_seat_id
    or old.pickup_at is distinct from new.pickup_at
    or old.return_at is distinct from new.return_at
    or old.external_booking_number is distinct from new.external_booking_number
    or old.child_age_band is distinct from new.child_age_band
    or old.child_height is distinct from new.child_height
    or old.vehicle is distinct from new.vehicle
    or old.vehicle_bay is distinct from new.vehicle_bay
    or old.notes is distinct from new.notes
  )
  execute function public.record_booking_event();

-- -----------------------------------------------------------------------------
-- Guard trigger (BEFORE UPDATE) on bookings. RLS cannot restrict columns, so
-- without this any admin/ops user could PATCH status, the assigned seat, the
-- owning partner, the rate, etc. directly and bypass the RPC validation.
-- Protected columns change only inside the booking RPCs, which set the
-- transaction-local signal app.booking_change = 'on'. Unset or blank = reject.
-- Not protected: assigned_technician_id, flight_id, incident_status, arrival
-- timestamps, external_booking_number, child_*, vehicle*, notes (owned by
-- later workflows or freely editable).
-- Exception: the FK action "ON DELETE SET NULL" on assigned_seat_id runs as a
-- nested trigger (pg_trigger_depth() > 1); it may only null that one column,
-- so deleting a seat is not blocked. A user PATCH always runs at depth 1.
-- This relies on there being no seats DELETE policy for client roles: if one
-- is ever added, a client could unassign a seat by deleting it.
-- Error code 55000, the same as the seats guard. SECURITY INVOKER; reads no
-- tables. A trigger function is not exposed through PostgREST RPC.
-- -----------------------------------------------------------------------------
create function public.guard_booking_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_in_rpc boolean :=
    coalesce(nullif(btrim(current_setting('app.booking_change', true)), ''), 'off') = 'on';
begin
  if v_in_rpc then
    return new;
  end if;

  if pg_trigger_depth() > 1
     and old.assigned_seat_id is not null
     and new.assigned_seat_id is null
     and (to_jsonb(new) - 'assigned_seat_id' - 'updated_at')
         = (to_jsonb(old) - 'assigned_seat_id' - 'updated_at') then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.assigned_seat_id is distinct from old.assigned_seat_id
     or new.partner_id is distinct from old.partner_id
     or new.booking_number is distinct from old.booking_number
     or new.airport_id is distinct from old.airport_id
     or new.seat_category_id is distinct from old.seat_category_id
     or new.pickup_at is distinct from old.pickup_at
     or new.return_at is distinct from old.return_at
     or new.daily_rate is distinct from old.daily_rate
     or new.paid_days is distinct from old.paid_days
     or new.gross_revenue is distinct from old.gross_revenue
     or new.partner_share is distinct from old.partner_share
     or new.platform_share is distinct from old.platform_share
  then
    raise exception 'Booking status, seat, schedule, ownership and finance fields can only be changed through the booking functions'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_booking_update() from public;
revoke execute on function public.guard_booking_update() from anon;

-- -----------------------------------------------------------------------------
-- Guard trigger (BEFORE INSERT) on bookings. The INSERT policy
-- bookings_insert_admin_ops_manager is unchanged, but a direct INSERT would
-- skip every RPC rule (partner/category checks, seat rules, status pending,
-- generated booking_number). Client roles (authenticated, anon, service_role)
-- may insert only inside create_booking(), which sets app.booking_change.
-- Owner roles (postgres, supabase_admin) are exempt: the seed and migrations
-- run as the owner; PostgREST never connects as those roles.
-- -----------------------------------------------------------------------------
create function public.guard_booking_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin')
     or coalesce(nullif(btrim(current_setting('app.booking_change', true)), ''), 'off') = 'on' then
    return new;
  end if;

  raise exception 'Bookings can only be created through create_booking()'
    using errcode = '55000';
end;
$$;

revoke execute on function public.guard_booking_insert() from public;
revoke execute on function public.guard_booking_insert() from anon;

create trigger guard_bookings_insert
  before insert on public.bookings
  for each row
  execute function public.guard_booking_insert();

create trigger guard_bookings_update
  before update on public.bookings
  for each row
  execute function public.guard_booking_update();

-- -----------------------------------------------------------------------------
-- booking_events is append-only for every role, including service_role.
-- UPDATE is allowed only for the nested FK action "ON DELETE SET NULL" that
-- nulls seat_id or user_id when a seat/user is deleted (depth > 1).
-- -----------------------------------------------------------------------------
create function public.prevent_booking_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'booking_events is append-only' using errcode = '55000';
  end if;

  if pg_trigger_depth() > 1
     and (to_jsonb(new) - 'seat_id' - 'user_id') = (to_jsonb(old) - 'seat_id' - 'user_id')
     and (new.seat_id is null or new.seat_id = old.seat_id)
     and (new.user_id is null or new.user_id = old.user_id) then
    return new;
  end if;

  raise exception 'booking_events is append-only' using errcode = '55000';
end;
$$;

revoke execute on function public.prevent_booking_event_mutation() from public;
revoke execute on function public.prevent_booking_event_mutation() from anon;

create trigger prevent_booking_events_update
  before update on public.booking_events
  for each row
  execute function public.prevent_booking_event_mutation();

create trigger prevent_booking_events_delete
  before delete on public.booking_events
  for each row
  execute function public.prevent_booking_event_mutation();

create trigger prevent_booking_events_truncate
  before truncate on public.booking_events
  for each statement
  execute function public.prevent_booking_event_mutation();

-- -----------------------------------------------------------------------------
-- Remove direct INSERT access to booking_events (events are server-written).
-- -----------------------------------------------------------------------------
drop policy "booking_events_insert_admin_ops_manager" on public.booking_events;
drop policy "booking_events_insert_technician" on public.booking_events;

-- Rollback (run manually against the target database if needed):
-- create policy "booking_events_insert_technician"
--   on public.booking_events for insert
--   to authenticated
--   with check (
--     exists (
--       select 1
--       from public.bookings b
--       where b.id = booking_events.booking_id
--         and (
--           b.assigned_technician_id = (select auth.uid())
--           or exists (
--             select 1
--             from public.technician_jobs tj
--             where tj.booking_id = b.id
--               and tj.technician_id = (select auth.uid())
--           )
--         )
--     )
--   );
-- create policy "booking_events_insert_admin_ops_manager"
--   on public.booking_events for insert
--   to authenticated
--   with check ((select public.is_admin_or_ops_manager()));
-- drop trigger if exists prevent_booking_events_truncate on public.booking_events;
-- drop trigger if exists prevent_booking_events_delete on public.booking_events;
-- drop trigger if exists prevent_booking_events_update on public.booking_events;
-- drop function if exists public.prevent_booking_event_mutation();
-- drop trigger if exists guard_bookings_update on public.bookings;
-- drop trigger if exists guard_bookings_insert on public.bookings;
-- drop function if exists public.guard_booking_insert();
-- drop function if exists public.guard_booking_update();
-- drop trigger if exists record_bookings_event_update on public.bookings;
-- drop trigger if exists record_bookings_event_insert on public.bookings;
-- drop function if exists public.record_booking_event();
-- drop function if exists public.generate_booking_number();
-- drop sequence if exists public.booking_number_seq;
