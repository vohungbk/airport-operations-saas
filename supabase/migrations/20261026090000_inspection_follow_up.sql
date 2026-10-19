-- FO-F04-S05: follow up a failed inspection.
--
-- Decisions (spec open question Q2):
--   * A failed inspection moves the seat to quarantine ("Inspection failed"),
--     in the same transaction as the insert, and the move is written to
--     seat_status_history by the existing trigger. pass and conditional_pass
--     leave the seat as it is.
--   * A seat that is already in quarantine is left as it is (no extra history).
--   * When the seat is in an active booking (pending, confirmed, assigned or
--     in_progress, and not yet returned) the seat is still quarantined and the
--     record says so, so the screen can warn the person who recorded it.
--     Bookings are not changed here; a manager decides.
--   * No incident is created (FO-F05 owns incidents).
--
-- inspection_records.follow_up is set only by guard_inspection_insert(): what
-- happened to the seat when the record was written. Whatever a client sends
-- for it is overwritten. The log stays immutable (UPDATE is revoked).
--
-- The seat is moved with the internal apply_cleaning_seat_status(), which
-- sets the signals guard_seat_update() and the history trigger read. Clients
-- cannot call it; this function is SECURITY DEFINER.

alter table public.inspection_records
  add column follow_up text
    constraint inspection_records_follow_up_check
    check (follow_up in ('seat_quarantined', 'seat_quarantined_active_booking'));

create or replace function public.guard_inspection_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_type public.technician_job_type;
  v_job_status public.technician_job_status;
  v_booking_id uuid;
  v_seat_id uuid;
  v_seat_status public.seat_status;
begin
  -- Never trust a client-supplied value.
  new.follow_up := null;

  if new.technician_job_id is null then
    return new;
  end if;

  select tj.job_type, tj.status, tj.booking_id, b.assigned_seat_id
    into v_job_type, v_job_status, v_booking_id, v_seat_id
    from public.technician_jobs tj
    join public.bookings b on b.id = tj.booking_id
   where tj.id = new.technician_job_id;

  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  if v_job_type is distinct from 'inspection' then
    raise exception 'The job is not an inspection job' using errcode = 'JB005';
  end if;

  if v_job_status not in ('assigned', 'in_progress') then
    raise exception 'The job is not active' using errcode = 'JB006';
  end if;

  if v_seat_id is null then
    raise exception 'The booking has no seat assigned' using errcode = 'JB007';
  end if;

  select s.status
    into v_seat_status
    from public.seats s
   where s.id = v_seat_id;

  if v_seat_status = 'retired' then
    raise exception 'A retired seat cannot be inspected' using errcode = 'JB007';
  end if;

  new.seat_id := v_seat_id;
  new.booking_id := v_booking_id;
  -- The form has no type; every inspection recorded for a job is a general one.
  new.inspection_type := 'general';

  -- The caller is the one who recorded it. Without an app user (a trusted
  -- server insert) the given inspector_id is kept.
  new.inspector_id := coalesce(
    (select u.id from public.users u where u.id = auth.uid()),
    new.inspector_id
  );

  if new.result = 'fail' then
    -- Lock the seat so two inspections or a cleaning cannot interleave.
    select s.status
      into v_seat_status
      from public.seats s
     where s.id = v_seat_id
       for update;

    if v_seat_status is distinct from 'quarantine' then
      perform public.apply_cleaning_seat_status(
        v_seat_id, 'quarantine', 'Inspection failed'
      );

      new.follow_up := case
        when exists (
          select 1
            from public.bookings b
           where b.assigned_seat_id = v_seat_id
             and b.status in ('pending', 'confirmed', 'assigned', 'in_progress')
             and b.return_at > now()
        ) then 'seat_quarantined_active_booking'
        else 'seat_quarantined'
      end;
    end if;
  end if;

  return new;
end;
$$;

-- Rollback (run manually against the target database if needed). Restore the
-- previous guard_inspection_insert() from 20261024090000_inspection_record_guard.sql,
-- then drop the column:
-- alter table public.inspection_records drop column if exists follow_up;
