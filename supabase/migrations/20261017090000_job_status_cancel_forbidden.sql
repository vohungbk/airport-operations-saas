-- FO-F01-S08: a caller who may not cancel a job (anyone but admin/ops, for
-- example a manager whose role was revoked while the screen was open) now
-- gets 42501 (forbidden) from change_technician_job_status() instead of
-- 55000 (invalid transition), so the UI can show a forbidden state.
--
-- Same signature and behavior otherwise; the check runs after the job is
-- found (a job the caller cannot see is still P0002) and before the stale
-- check (permission is more basic than freshness).
--
-- Error codes:
--   42501  caller may not cancel a job (not admin/ops)
--   P0002  job not found (or hidden by RLS)
--   22023  a reason is required to cancel
--   55000  invalid transition
--   JB004  job status changed since the caller loaded it (stale)

create or replace function public.change_technician_job_status(
  p_job_id uuid,
  p_from_status public.technician_job_status,
  p_to_status public.technician_job_status,
  p_reason text default null
)
returns public.technician_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.technician_jobs;
  v_reason text := nullif(btrim(p_reason), '');
  v_is_manager boolean := coalesce(public.is_admin_or_ops_manager(), false);
begin
  select *
    into v_job
    from public.technician_jobs tj
   where tj.id = p_job_id
     for update;

  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  if p_to_status = 'cancelled' and not v_is_manager then
    raise exception 'Only a manager can cancel a job' using errcode = '42501';
  end if;

  if v_job.status is distinct from p_from_status then
    raise exception 'Job was changed by someone else' using errcode = 'JB004';
  end if;

  if not (
    (v_job.status = 'assigned' and p_to_status = 'in_progress')
    or (v_job.status = 'in_progress' and p_to_status = 'completed')
    or (v_is_manager and v_job.status in ('assigned', 'in_progress') and p_to_status = 'cancelled')
  ) then
    raise exception 'Invalid job status transition: % -> %', v_job.status, p_to_status
      using errcode = '55000';
  end if;

  if p_to_status = 'cancelled' and v_reason is null then
    raise exception 'A reason is required to cancel a job' using errcode = '22023';
  end if;

  perform set_config('app.job_event_notes', coalesce(v_reason, ''), true);
  perform set_config('app.job_status_change', 'on', true);

  update public.technician_jobs tj
     set status = p_to_status,
         started_at = case when p_to_status = 'in_progress' then now() else tj.started_at end,
         completed_at = case when p_to_status = 'completed' then now() else tj.completed_at end
   where tj.id = p_job_id
  returning tj.* into v_job;

  if not found then
    raise exception 'Job not found' using errcode = 'P0002';
  end if;

  perform set_config('app.job_event_notes', '', true);
  perform set_config('app.job_status_change', '', true);

  return v_job;
end;
$$;

-- Rollback (run manually against the target database if needed): re-run the
-- definition of change_technician_job_status() from
-- 20261016090000_technician_job_events_and_status_rpc.sql.
