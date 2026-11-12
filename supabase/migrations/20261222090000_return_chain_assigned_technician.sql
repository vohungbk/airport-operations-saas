-- FO-F08-S08 (R8, E6): only the assigned technician or a permitted internal role may complete a
-- step of the return chain. A QR scan alone grants nothing.
--
-- "Assigned" is bookings.assigned_technician_id, the same column that lets a technician read the
-- booking (bookings_select_technician).
--
-- complete_return_chain_step() is replaced with the same signature, grants and checks. Only the
-- access check changes:
--   - admin and operations_manager may complete any step, as before;
--   - an active technician may complete a step only of a booking assigned to them;
--   - anyone else, and a technician on a booking that is not theirs (or does not exist, or is not
--     in the chain), gets 42501, so a technician learns nothing about other bookings.
--
-- So the assigned technician can use the chain step screen, they may also:
--   - read the steps of their booking (return_chain_steps);
--   - read the seat of their booking while it is in the chain (returned, cleaning, inspection);
--     seats_select_technician covers only seats of their technician jobs;
--   - add and read photos under <booking id>/ of their booking in return-chain-photos.
-- Nobody gains a write path to the tables: rows still come only from the function.
--
-- The helpers are SECURITY DEFINER, like current_user_role(), so the policies do not re-run the
-- RLS of bookings from inside other tables' policies.

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create function public.is_assigned_technician_of_booking(p_booking_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'technician', false)
     and exists (
       select 1
         from public.bookings b
        where b.id = p_booking_id
          and b.assigned_technician_id = auth.uid()
     );
$$;

create function public.is_chain_technician_of_seat(p_seat_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'technician', false)
     and exists (
       select 1
         from public.bookings b
        where b.assigned_seat_id = p_seat_id
          and b.status in ('returned', 'cleaning', 'inspection')
          and b.assigned_technician_id = auth.uid()
     );
$$;

revoke execute on function public.is_assigned_technician_of_booking(uuid) from public, anon;
revoke execute on function public.is_chain_technician_of_seat(uuid) from public, anon;
grant execute on function public.is_assigned_technician_of_booking(uuid) to authenticated;
grant execute on function public.is_chain_technician_of_seat(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Policies
-- -----------------------------------------------------------------------------
create policy "return_chain_steps_select_assigned_technician"
  on public.return_chain_steps for select
  to authenticated
  using ((select public.is_assigned_technician_of_booking(booking_id)));

create policy "seats_select_chain_technician"
  on public.seats for select
  to authenticated
  using ((select public.is_chain_technician_of_seat(id)));

create policy "return_chain_photos_insert_assigned_technician"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'return-chain-photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.is_assigned_technician_of_booking(((storage.foldername(name))[1])::uuid)
  );

create policy "return_chain_photos_select_assigned_technician"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'return-chain-photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.is_assigned_technician_of_booking(((storage.foldername(name))[1])::uuid)
  );

-- -----------------------------------------------------------------------------
-- complete_return_chain_step()
-- -----------------------------------------------------------------------------
create or replace function public.complete_return_chain_step(
  p_booking_id uuid,
  p_step text,
  p_result public.inspection_result,
  p_checklist jsonb,
  p_notes text,
  p_photo_paths text[]
)
returns public.return_chain_steps
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- The period a booking must not overlap when the chain starts or completes (FO-F03 R10).
  c_conflict_period constant interval := interval '2 hours';
  v_now timestamptz := now();
  v_user uuid := auth.uid();
  v_booking public.bookings;
  v_seat public.seats;
  v_notes text := nullif(btrim(p_notes), '');
  v_status_order integer;
  v_last_order integer;
  v_current text;
  v_next text;
  v_item text;
  v_path text;
  v_booking_to public.booking_status;
  v_seat_to public.seat_status;
  v_record public.return_chain_steps;
  v_is_manager boolean := coalesce(public.is_admin_or_ops_manager(), false);
  v_is_technician boolean := coalesce(public.current_user_role() = 'technician', false);
begin
  if v_user is null or not (v_is_manager or v_is_technician) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select *
    into v_booking
    from public.bookings b
   where b.id = p_booking_id
     and b.status in ('returned', 'cleaning', 'inspection')
     for update;

  -- R8, E6: a technician acts only on a booking assigned to them, and is told nothing more.
  if not v_is_manager
     and (not found or v_booking.assigned_technician_id is distinct from v_user) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if not found or v_booking.assigned_seat_id is null then
    raise exception 'Booking not in the return chain' using errcode = 'P0002';
  end if;

  select *
    into v_seat
    from public.seats s
   where s.id = v_booking.assigned_seat_id
     for update;

  if v_seat.status = 'quarantine' then
    raise exception 'The seat is in quarantine' using errcode = '55000';
  end if;

  v_status_order := public.return_chain_step_order(
    case v_booking.status
      when 'returned' then 'returned'
      when 'cleaning' then 'cleaning'
      else 'final_inspection'
    end
  );

  select max(public.return_chain_step_order(r.step))
    into v_last_order
    from public.return_chain_steps r
   where r.booking_id = v_booking.id;

  v_current := (array['returned', 'initial_inspection', 'cleaning', 'drying', 'reassembly', 'final_inspection', 'available'])[
    greatest(v_status_order, coalesce(v_last_order, 0) + 1)
  ];

  if p_step is distinct from v_current or v_current = 'available' then
    raise exception 'The step is not the next one in the chain'
      using errcode = 'RC001', detail = v_current;
  end if;

  if p_result not in ('pass', 'fail') then
    raise exception 'The result must be Pass or Fail' using errcode = '22023';
  end if;

  if p_result = 'fail' and v_notes is null then
    raise exception 'Notes are required when the result is Fail' using errcode = '22023';
  end if;

  if length(v_notes) > 1000 then
    raise exception 'The notes must be at most 1000 characters' using errcode = '22023';
  end if;

  if p_checklist is null or jsonb_typeof(p_checklist) <> 'object' then
    raise exception 'Every checklist item must be answered' using errcode = '22023';
  end if;

  foreach v_item in array public.return_chain_checklist(v_current) loop
    if coalesce(p_checklist ->> v_item, '') <> 'true' then
      raise exception 'Every checklist item must be answered' using errcode = '22023';
    end if;
  end loop;

  if coalesce(cardinality(p_photo_paths), 0) = 0 then
    raise exception 'A photo is required for this step' using errcode = '22023';
  end if;

  foreach v_path in array p_photo_paths loop
    if v_path not like v_booking.id::text || '/' || v_current || '/%'
       or not exists (
         select 1
           from storage.objects o
          where o.bucket_id = 'return-chain-photos'
            and o.name = v_path
       ) then
      raise exception 'A photo is required for this step' using errcode = '22023';
    end if;
  end loop;

  -- R10: the chain starts or completes while another booking holds or uses the seat in the period
  -- from now for c_conflict_period. The booking of the chain itself is not a clash.
  if (v_current = 'returned' or (v_current = 'final_inspection' and p_result = 'pass'))
     and exists (
       select 1
         from public.bookings b
        where b.assigned_seat_id = v_seat.id
          and b.id <> v_booking.id
          and b.status in ('pending', 'confirmed', 'assigned', 'in_progress')
          and b.pickup_at < v_now + c_conflict_period
          and v_now < b.return_at
     ) then
    raise exception 'A booking holds or uses the seat in a conflicting period'
      using errcode = 'RC002';
  end if;

  insert into public.return_chain_steps (
    booking_id, seat_id, step, result, checklist, notes, photo_paths, completed_by
  )
  values (
    v_booking.id, v_seat.id, v_current, p_result, p_checklist, v_notes, p_photo_paths, v_user
  )
  returning * into v_record;

  v_next := (array['returned', 'initial_inspection', 'cleaning', 'drying', 'reassembly', 'final_inspection', 'available'])[
    public.return_chain_step_order(v_current) + 1
  ];

  if p_result = 'fail' then
    perform set_config('app.seat_status_reason', 'Return chain: ' || v_current || ' failed', true);
    perform set_config('app.seat_status_change', 'on', true);

    update public.seats s
       set status = 'quarantine',
           quarantine_reason = v_notes
     where s.id = v_seat.id;

    perform set_config('app.seat_status_reason', '', true);
    perform set_config('app.seat_status_change', '', true);

    return v_record;
  end if;

  v_seat_to := case
    when v_next in ('initial_inspection', 'final_inspection') then 'inspection'
    when v_next in ('cleaning', 'drying', 'reassembly') then 'cleaning'
    else 'available'
  end::public.seat_status;

  v_booking_to := case v_next
    when 'cleaning' then 'cleaning'
    when 'final_inspection' then 'inspection'
    when 'available' then 'completed'
  end::public.booking_status;

  if v_booking_to is not null and v_booking_to is distinct from v_booking.status then
    perform set_config('app.booking_event_notes', 'Return chain: ' || v_current || ' completed', true);
    perform set_config('app.booking_change', 'on', true);

    update public.bookings b
       set status = v_booking_to
     where b.id = v_booking.id;

    perform set_config('app.booking_event_notes', '', true);
    perform set_config('app.booking_change', '', true);
  end if;

  if v_next = 'available' then
    update public.seats s
       set rental_cycles = s.rental_cycles + 1
     where s.id = v_seat.id;

    -- E7: the seat has reached its maximum rental cycles; flag it for retirement.
    if v_seat.rental_cycles + 1 >= v_seat.max_rental_cycles then
      perform set_config('app.seat_status_reason', 'Return chain: max rental cycles reached', true);
      perform set_config('app.seat_status_change', 'on', true);

      update public.seats s
         set status = 'quarantine',
             quarantine_reason = 'Reached max rental cycles'
       where s.id = v_seat.id;

      perform set_config('app.seat_status_reason', '', true);
      perform set_config('app.seat_status_change', '', true);

      return v_record;
    end if;
  end if;

  if v_seat_to is distinct from v_seat.status then
    perform public.apply_booking_seat_status(
      v_seat.id,
      v_seat_to,
      'Booking ' || v_booking.booking_number || ': return chain ' || v_current || ' completed'
    );
  end if;

  return v_record;
end;
$$;

revoke execute on function public.complete_return_chain_step(uuid, text, public.inspection_result, jsonb, text, text[]) from public;
revoke execute on function public.complete_return_chain_step(uuid, text, public.inspection_result, jsonb, text, text[]) from anon;
grant execute on function public.complete_return_chain_step(uuid, text, public.inspection_result, jsonb, text, text[]) to authenticated;

-- Rollback (run manually against the target database if needed):
-- re-run the create or replace function public.complete_return_chain_step(...) block of
-- 20261221090000_return_chain_booking_conflict.sql, then:
-- drop policy if exists "return_chain_photos_select_assigned_technician" on storage.objects;
-- drop policy if exists "return_chain_photos_insert_assigned_technician" on storage.objects;
-- drop policy if exists "seats_select_chain_technician" on public.seats;
-- drop policy if exists "return_chain_steps_select_assigned_technician" on public.return_chain_steps;
-- drop function if exists public.is_chain_technician_of_seat(uuid);
-- drop function if exists public.is_assigned_technician_of_booking(uuid);
