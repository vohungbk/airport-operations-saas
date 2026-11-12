-- FO-F08-S07 (R10): when the return chain starts or completes, a booking that holds or uses the
-- seat in a conflicting period stops it, by the conflict rule of FO-F03 (start_cleaning(), JB009).
--
-- complete_return_chain_step() is replaced with the same signature, grants and checks. One check is
-- added, before the step is recorded:
--   - it runs when the chain starts (the returned step) and when it completes (a pass on the final
--     inspection); the steps in between are not checked;
--   - the clash is the one start_cleaning() uses: another booking of the seat in pending,
--     confirmed, assigned or in_progress whose period overlaps the period from now for
--     c_conflict_period;
--   - the step is refused with RC002. Nothing changes: no step is recorded, and the seat and the
--     booking keep their status.
--
-- c_conflict_period is the cleaning period of FO-F03 (2 hours, spec FO-F03 Q6 and FO-F08 Q4 are
-- open). Keep it equal to c_cleaning_period in start_cleaning() and CLEANING_PERIOD_HOURS.
--
-- The seat row is locked before the check, as in start_cleaning(), so a booking and a step cannot
-- both get through at the same moment.

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
begin
  if v_user is null or not coalesce(public.is_admin_or_ops_manager(), false) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select *
    into v_booking
    from public.bookings b
   where b.id = p_booking_id
     and b.status in ('returned', 'cleaning', 'inspection')
     for update;

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

-- Rollback (run manually against the target database if needed): re-run the
-- create or replace function public.complete_return_chain_step(...) block of
-- 20261220090000_return_chain_max_rental_cycles.sql.
