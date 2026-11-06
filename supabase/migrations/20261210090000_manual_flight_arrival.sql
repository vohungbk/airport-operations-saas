-- VI-F02-S07: enter an arrival by hand (spec VI-F02 E2, E6, Q4).
--
-- Operations (an admin or an operations manager) can enter the arrival of a flight by hand, with a reason that is
-- required. The flight shows the value as Manual until the provider returns data after the entry; then the provider
-- wins and the mark is cleared. Every manual entry is kept in the flight history with its reason.
--
-- 1. flights.manual_entered_at and flights.manual_reason: the Manual mark. Both are set together or both are null.
-- 2. flight_updates.reason: the reason of a manual entry. It is required when the source is `manual`.
-- 3. apply_flight_refresh() takes one more argument, p_reason (default null). A write from the source `manual` needs a
--    reason and at least one change, sets the mark and keeps the reason in the history. A write from any other source
--    (provider, system) clears the mark: the provider has answered after the entry, so its data wins. A refresh that
--    gets no answer (flight not found, provider error) writes nothing, so the manual value stays. The provider gives no
--    time of its own, so "newer" means "answered after the entry". EXECUTE stays with service_role only.
-- 4. enter_manual_arrival(): the one door for a signed-in user. It checks the role inside the function (admin or
--    operations manager, 42501 otherwise), refuses a booking that has ended, and, for a booking whose flight the
--    provider did not know (no flight row), creates the flight with the scheduled arrival that was entered and links
--    the booking. The write itself goes through apply_flight_refresh() with the source fixed to `manual`.
--
-- Error codes: 42501  the caller is not an admin or an operations manager.
--              22023  a value is missing or not allowed (reason, changes, scheduled arrival, ended booking, no number).
--              P0002  the booking or the flight does not exist.
--
-- No table is added and no policy changes: flights and flight_updates keep their RLS and the append-only trigger. The
-- reason is readable by whoever may read the flight (spec R15), like the rest of the history.
--
-- Rollback:
--   drop function public.enter_manual_arrival(uuid, jsonb, jsonb, text, timestamptz, timestamptz);
--   drop function public.apply_flight_refresh(uuid, jsonb, jsonb, text, timestamptz, text);
--   then create apply_flight_refresh again from 20261203090000_flight_updates.sql (five arguments, same grants);
--   alter table public.flight_updates drop constraint flight_updates_manual_reason_check, drop column reason;
--   alter table public.flights drop constraint flights_manual_pair_check, drop column manual_reason, drop column manual_entered_at;

alter table public.flights
  add column manual_entered_at timestamptz,
  add column manual_reason text;

alter table public.flights
  add constraint flights_manual_pair_check
  check ((manual_entered_at is null) = (manual_reason is null));

alter table public.flight_updates
  add column reason text;

alter table public.flight_updates
  add constraint flight_updates_manual_reason_check
  check (source <> 'manual' or (reason is not null and btrim(reason) <> ''));

-- The old five-argument function goes first: next to the new one it would make a call with five arguments ambiguous.
drop function public.apply_flight_refresh(uuid, jsonb, jsonb, text, timestamptz);

create function public.apply_flight_refresh(
  p_flight_id uuid,
  p_values jsonb,
  p_changes jsonb,
  p_source text,
  p_expected_synced_at timestamptz default null,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manual boolean := p_source = 'manual';
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_flight_id is null or p_values is null or jsonb_typeof(p_values) <> 'object' then
    raise exception 'A value is missing' using errcode = '22023';
  end if;

  if p_source is null or p_source not in ('provider', 'system', 'manual') then
    raise exception 'The source is not allowed' using errcode = '22023';
  end if;

  if p_changes is not null and jsonb_typeof(p_changes) <> 'array' then
    raise exception 'The changes are not a list' using errcode = '22023';
  end if;

  if v_manual and v_reason is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;

  if v_manual and (p_changes is null or jsonb_array_length(p_changes) = 0) then
    raise exception 'Nothing changed' using errcode = '22023';
  end if;

  update public.flights
     set status = (p_values ->> 'status')::public.flight_status,
         estimated_arrival_at = (p_values ->> 'estimated_arrival_at')::timestamptz,
         actual_arrival_at = (p_values ->> 'actual_arrival_at')::timestamptz,
         terminal = p_values ->> 'terminal',
         delay_minutes = (p_values ->> 'delay_minutes')::integer,
         provider = p_values ->> 'provider',
         last_synced_at = now(),
         -- a manual entry sets the mark; an answer of the provider (or the system) clears it
         manual_entered_at = case when v_manual then now() end,
         manual_reason = case when v_manual then v_reason end
   where id = p_flight_id
     and last_synced_at is not distinct from p_expected_synced_at;

  if not found then
    if not exists (select 1 from public.flights where id = p_flight_id) then
      raise exception 'The flight does not exist' using errcode = 'P0002';
    end if;

    -- Another run refreshed it since it was read: its answer is the newer one.
    return false;
  end if;

  if p_changes is not null and jsonb_array_length(p_changes) > 0 then
    insert into public.flight_updates (flight_id, source, changes, reason)
    values (p_flight_id, p_source, p_changes, case when v_manual then v_reason end);
  end if;

  return true;
end;
$$;

revoke execute on function public.apply_flight_refresh(uuid, jsonb, jsonb, text, timestamptz, text) from public;
revoke execute on function public.apply_flight_refresh(uuid, jsonb, jsonb, text, timestamptz, text) from anon;
revoke execute on function public.apply_flight_refresh(uuid, jsonb, jsonb, text, timestamptz, text) from authenticated;
grant execute on function public.apply_flight_refresh(uuid, jsonb, jsonb, text, timestamptz, text) to service_role;

-- -----------------------------------------------------------------------------
-- enter_manual_arrival(): for an admin or an operations manager.
-- Returns the id of the flight, or null when the flight was refreshed since the caller read it (nothing is written).
-- -----------------------------------------------------------------------------
create function public.enter_manual_arrival(
  p_booking_id uuid,
  p_values jsonb,
  p_changes jsonb,
  p_reason text,
  p_scheduled_arrival_at timestamptz default null,
  p_expected_synced_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking record;
  v_flight_id uuid;
  v_expected timestamptz := p_expected_synced_at;
begin
  if not (select public.is_admin_or_ops_manager()) then
    raise exception 'Only an admin or an operations manager may enter an arrival by hand' using errcode = '42501';
  end if;

  select b.id, b.status, b.airport_id, b.flight_id, b.flight_number
    into v_booking
    from public.bookings b
   where b.id = p_booking_id
     for update;

  if not found then
    raise exception 'The booking does not exist' using errcode = 'P0002';
  end if;

  if v_booking.status in ('completed', 'cancelled', 'no_show') then
    raise exception 'The booking has ended' using errcode = '22023';
  end if;

  if v_booking.flight_number is null then
    raise exception 'The booking has no flight number' using errcode = '22023';
  end if;

  v_flight_id := v_booking.flight_id;

  if v_flight_id is null then
    -- The provider did not know the flight: the flight is made here, from what was entered.
    if p_scheduled_arrival_at is null then
      raise exception 'A scheduled arrival is required' using errcode = '22023';
    end if;

    select f.id, f.last_synced_at
      into v_flight_id, v_expected
      from public.flights f
     where f.flight_number = v_booking.flight_number
       and f.airport_id = v_booking.airport_id
       and f.scheduled_arrival_at = p_scheduled_arrival_at
     order by f.created_at
     limit 1;

    -- A flight that already exists is read here, so its own sync time is the one expected.
    if v_flight_id is null then
      v_expected := null;

      insert into public.flights (flight_number, airport_id, scheduled_arrival_at, provider)
      values (v_booking.flight_number, v_booking.airport_id, p_scheduled_arrival_at, 'manual')
      returning id into v_flight_id;
    end if;

    update public.bookings
       set flight_id = v_flight_id, flight_lookup_status = 'linked'
     where id = p_booking_id;
  end if;

  if not public.apply_flight_refresh(v_flight_id, p_values, p_changes, 'manual', v_expected, p_reason) then
    return null;
  end if;

  return v_flight_id;
end;
$$;

revoke execute on function public.enter_manual_arrival(uuid, jsonb, jsonb, text, timestamptz, timestamptz) from public;
revoke execute on function public.enter_manual_arrival(uuid, jsonb, jsonb, text, timestamptz, timestamptz) from anon;
grant execute on function public.enter_manual_arrival(uuid, jsonb, jsonb, text, timestamptz, timestamptz) to authenticated;

comment on function public.enter_manual_arrival(uuid, jsonb, jsonb, text, timestamptz, timestamptz) is
  'Admin or operations manager only. Stores an arrival entered by hand (source manual, with a required reason) through apply_flight_refresh(); creates and links the flight when the booking has none.';
