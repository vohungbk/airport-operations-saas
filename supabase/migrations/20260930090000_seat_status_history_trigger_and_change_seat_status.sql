-- F09: seat status history trigger + change_seat_status() RPC.
--
-- Why: PostgREST cannot run "update seats + insert seat_status_history" in
-- one transaction. A trigger on public.seats makes every status change
-- (including future F16-F18 workflows) write history atomically, so a
-- status can never change without an audit row.
--
-- No existing policy is changed. seat_status_history still has no
-- UPDATE/DELETE policy (append-only). No service-role access is involved.

-- -----------------------------------------------------------------------------
-- Trigger function. SECURITY DEFINER so the audit row is written even though
-- the caller's own RLS context is only what authorized the seats write.
-- It runs only as a trigger (returns trigger), never callable over RPC.
-- changed_by is resolved through public.users because the column has an FK
-- to public.users(id); an auth user without a profile row gets NULL instead
-- of making the whole seat write fail.
-- -----------------------------------------------------------------------------
create function public.record_seat_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_changed_by uuid;
begin
  v_reason := nullif(btrim(current_setting('app.seat_status_reason', true)), '');

  select u.id
    into v_changed_by
    from public.users u
   where u.id = auth.uid();

  if tg_op = 'INSERT' then
    insert into public.seat_status_history (seat_id, from_status, to_status, changed_by, reason)
    values (new.id, null, new.status, v_changed_by, v_reason);
  else
    insert into public.seat_status_history (seat_id, from_status, to_status, changed_by, reason)
    values (new.id, old.status, new.status, v_changed_by, v_reason);
  end if;

  return null;
end;
$$;

revoke execute on function public.record_seat_status_change() from public;
revoke execute on function public.record_seat_status_change() from anon;

create trigger record_seats_status_insert
  after insert on public.seats
  for each row
  execute function public.record_seat_status_change();

create trigger record_seats_status_update
  after update of status on public.seats
  for each row
  when (old.status is distinct from new.status)
  execute function public.record_seat_status_change();

-- -----------------------------------------------------------------------------
-- Guard trigger (BEFORE UPDATE). RLS cannot restrict columns, so without this
-- any seats:manage user could PATCH status/serial_number/public_token directly
-- and bypass the transition rules in change_seat_status().
--   * serial_number and public_token are immutable after insert.
--   * retired is terminal: status can never leave it.
--   * status, retired_at and quarantine_reason change only inside
--     change_seat_status(), which sets the transaction-local signal
--     app.seat_status_change = 'on' (distinct from app.seat_status_reason).
--     Unset or blank means reject.
-- All errors use 55000 (object_not_in_prerequisite_state), the same code the
-- RPC uses for an invalid transition. INSERT is unaffected. Other columns
-- (manufacturer, model, dates, max_rental_cycles, category_id, airport_id,
-- rental_cycles, ...) update freely. SECURITY INVOKER: it reads no tables.
-- A trigger function (returns trigger) is not exposed through PostgREST RPC.
-- -----------------------------------------------------------------------------
create function public.guard_seat_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_in_rpc boolean :=
    coalesce(nullif(btrim(current_setting('app.seat_status_change', true)), ''), 'off') = 'on';
begin
  if new.serial_number is distinct from old.serial_number then
    raise exception 'Seat serial number cannot be changed' using errcode = '55000';
  end if;

  if new.public_token is distinct from old.public_token then
    raise exception 'Seat public token cannot be changed' using errcode = '55000';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'retired' then
      raise exception 'A retired seat cannot change status' using errcode = '55000';
    end if;

    if not v_in_rpc then
      raise exception 'Seat status can only be changed through change_seat_status()'
        using errcode = '55000';
    end if;
  end if;

  if not v_in_rpc and (
    new.retired_at is distinct from old.retired_at
    or new.quarantine_reason is distinct from old.quarantine_reason
  ) then
    raise exception 'Seat retirement and quarantine fields can only be changed through change_seat_status()'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_seat_update() from public;
revoke execute on function public.guard_seat_update() from anon;

create trigger guard_seats_update
  before update on public.seats
  for each row
  execute function public.guard_seat_update();

-- -----------------------------------------------------------------------------
-- change_seat_status(): the only manual status-change entry point for F09.
-- SECURITY INVOKER so seats RLS (admin/ops only for select + update) applies;
-- a caller RLS hides the seat from gets P0002 (not found).
-- Error codes: P0002 not found, 22023 invalid reason, 55000 invalid transition.
-- Allowed manual transitions (everything else is rejected):
--   available  -> quarantine (reason required, sets quarantine_reason)
--   quarantine -> available  (clears quarantine_reason)
--   available | quarantine -> retired (sets retired_at; terminal)
-- -----------------------------------------------------------------------------
create function public.change_seat_status(
  p_seat_id uuid,
  p_to_status public.seat_status,
  p_reason text
)
returns public.seats
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_seat public.seats;
  v_reason text := nullif(btrim(p_reason), '');
begin
  select *
    into v_seat
    from public.seats s
   where s.id = p_seat_id
     for update;

  if not found then
    raise exception 'Seat not found' using errcode = 'P0002';
  end if;

  if not (
    (v_seat.status = 'available' and p_to_status = 'quarantine')
    or (v_seat.status = 'quarantine' and p_to_status = 'available')
    or (v_seat.status in ('available', 'quarantine') and p_to_status = 'retired')
  ) then
    raise exception 'Invalid seat status transition: % -> %', v_seat.status, p_to_status
      using errcode = '55000';
  end if;

  if p_to_status = 'quarantine' and v_reason is null then
    raise exception 'A reason is required to quarantine a seat'
      using errcode = '22023';
  end if;

  -- Transaction-local; read by record_seat_status_change() during the update.
  perform set_config('app.seat_status_reason', coalesce(v_reason, ''), true);
  -- Signal read by guard_seat_update(); without it direct status updates fail.
  perform set_config('app.seat_status_change', 'on', true);

  update public.seats s
     set status = p_to_status,
         quarantine_reason = case
           when p_to_status = 'quarantine' then v_reason
           when p_to_status = 'available' then null
           else s.quarantine_reason
         end,
         retired_at = case
           when p_to_status = 'retired' then now()
           else s.retired_at
         end
   where s.id = p_seat_id
  returning s.* into v_seat;

  if not found then
    -- RLS update policy hid the row even though select let us see it.
    raise exception 'Seat not found' using errcode = 'P0002';
  end if;

  perform set_config('app.seat_status_reason', '', true);
  perform set_config('app.seat_status_change', '', true);

  return v_seat;
end;
$$;

revoke execute on function public.change_seat_status(uuid, public.seat_status, text) from public;
revoke execute on function public.change_seat_status(uuid, public.seat_status, text) from anon;
grant execute on function public.change_seat_status(uuid, public.seat_status, text) to authenticated;

-- Rollback (run manually against the target database if needed):
-- drop function if exists public.change_seat_status(uuid, public.seat_status, text);
-- drop trigger if exists guard_seats_update on public.seats;
-- drop function if exists public.guard_seat_update();
-- drop trigger if exists record_seats_status_update on public.seats;
-- drop trigger if exists record_seats_status_insert on public.seats;
-- drop function if exists public.record_seat_status_change();
