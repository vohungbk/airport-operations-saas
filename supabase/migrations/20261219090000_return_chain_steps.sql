-- FO-F08-S02: record a step of the return chain.
--
-- return_chain_steps holds one row per completed step of a booking's return chain: who, when, the
-- checklist, the result, the notes and the photos (spec R4, R9). Rows are written only by
-- complete_return_chain_step() and are never changed or deleted.
--
-- The chain: returned -> initial_inspection -> cleaning -> drying -> reassembly ->
-- final_inspection -> available. Available is the end of the chain, not a recorded step.
--
-- The step a booking is at: the step after the last recorded one, but never before the step its
-- booking status points to (returned -> returned, cleaning -> cleaning, inspection ->
-- final_inspection). The same rule is in src/features/return-queue/lib/return-chain.ts.
--
-- complete_return_chain_step(booking, step, result, checklist, notes, photo paths):
--   - admin and operations_manager only (technicians come with a later story); anyone else 42501.
--   - the booking must be in the chain (P0002 otherwise) and its seat not in quarantine (55000).
--   - p_step must be the step the booking is at, so a step out of order or completed twice is
--     refused (RC001, with the step the booking is at in DETAIL) (spec R3, E1, E4).
--   - result pass or fail; notes required on fail; every checklist item of the step ticked;
--     at least one photo, each one stored under <booking id>/<step>/ in return-chain-photos
--     (22023 otherwise).
--   - the seat follows (spec R5, R6, R7):
--       fail                       -> quarantine, with the notes as the reason; the chain stops
--       pass, next step inspection -> inspection
--       pass, next step cleaning, drying or reassembly -> cleaning
--       pass on final_inspection   -> available, and rental_cycles + 1
--   - the booking follows: cleaning when the chain reaches cleaning, inspection when it reaches
--     final_inspection, completed when the final inspection passes.
--
-- The checklist items of each step are a placeholder until the spec answers Q1; they are kept in
-- return_chain_checklist() and in RETURN_CHAIN_STEP_RULES (return-chain.ts).
--
-- SECURITY DEFINER with an empty search_path: the checks above are the access rule.

create table public.return_chain_steps (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  seat_id uuid not null references public.seats(id) on delete restrict,
  step text not null,
  result public.inspection_result not null,
  checklist jsonb not null,
  notes text,
  photo_paths text[] not null,
  completed_by uuid not null references public.users(id) on delete restrict,
  completed_at timestamptz not null default now(),
  constraint return_chain_steps_step_check check (
    step in ('returned', 'initial_inspection', 'cleaning', 'drying', 'reassembly', 'final_inspection')
  ),
  constraint return_chain_steps_result_check check (result in ('pass', 'fail')),
  constraint return_chain_steps_notes_on_fail check (result = 'pass' or nullif(btrim(notes), '') is not null),
  constraint return_chain_steps_photo_check check (cardinality(photo_paths) > 0),
  constraint return_chain_steps_booking_step_key unique (booking_id, step)
);

create index return_chain_steps_seat_id_idx on public.return_chain_steps (seat_id);

alter table public.return_chain_steps enable row level security;

-- Internal roles read every chain; partner users and technicians read none yet (spec 2.1).
create policy "return_chain_steps_select_admin_ops_manager"
  on public.return_chain_steps for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

-- History is never changed or deleted, and rows come only from the function below.
revoke insert, update, delete, truncate on public.return_chain_steps from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Photos: a private bucket. Internal roles add and read; nobody changes or removes.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('return-chain-photos', 'return-chain-photos', false, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "return_chain_photos_insert_admin_ops_manager"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'return-chain-photos' and (select public.is_admin_or_ops_manager()));

create policy "return_chain_photos_select_admin_ops_manager"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'return-chain-photos' and (select public.is_admin_or_ops_manager()));

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create function public.return_chain_step_order(p_step text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select array_position(
    array['returned', 'initial_inspection', 'cleaning', 'drying', 'reassembly', 'final_inspection', 'available'],
    p_step
  );
$$;

create function public.return_chain_checklist(p_step text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_step
    when 'returned' then array['seat_received', 'serial_matches', 'parts_returned']
    when 'initial_inspection' then array['shell_checked', 'harness_checked', 'buckle_checked']
    when 'cleaning' then array['shell_cleaned', 'harness_cleaned', 'straps_cleaned']
    when 'drying' then array['cover_dry', 'foam_dry', 'straps_dry']
    when 'reassembly' then array['cover_fitted', 'harness_fitted', 'buckle_fitted']
    when 'final_inspection' then array['shell_intact', 'harness_works', 'buckle_locks']
  end;
$$;

revoke execute on function public.return_chain_step_order(text) from public, anon;
revoke execute on function public.return_chain_checklist(text) from public, anon;
grant execute on function public.return_chain_step_order(text) to authenticated;
grant execute on function public.return_chain_checklist(text) to authenticated;

-- -----------------------------------------------------------------------------
-- complete_return_chain_step()
-- -----------------------------------------------------------------------------
create function public.complete_return_chain_step(
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

  if v_seat_to is distinct from v_seat.status then
    perform public.apply_booking_seat_status(
      v_seat.id,
      v_seat_to,
      'Booking ' || v_booking.booking_number || ': return chain ' || v_current || ' completed'
    );
  end if;

  if v_next = 'available' then
    update public.seats s
       set rental_cycles = s.rental_cycles + 1
     where s.id = v_seat.id;
  end if;

  return v_record;
end;
$$;

revoke execute on function public.complete_return_chain_step(uuid, text, public.inspection_result, jsonb, text, text[]) from public;
revoke execute on function public.complete_return_chain_step(uuid, text, public.inspection_result, jsonb, text, text[]) from anon;
grant execute on function public.complete_return_chain_step(uuid, text, public.inspection_result, jsonb, text, text[]) to authenticated;

-- Rollback (run manually against the target database if needed):
-- drop function if exists public.complete_return_chain_step(uuid, text, public.inspection_result, jsonb, text, text[]);
-- drop function if exists public.return_chain_checklist(text);
-- drop function if exists public.return_chain_step_order(text);
-- drop policy if exists "return_chain_photos_select_admin_ops_manager" on storage.objects;
-- drop policy if exists "return_chain_photos_insert_admin_ops_manager" on storage.objects;
-- delete from storage.buckets where id = 'return-chain-photos';
-- drop table if exists public.return_chain_steps;
