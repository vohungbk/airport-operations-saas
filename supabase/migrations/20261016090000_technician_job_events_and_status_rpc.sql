-- FO-F01-S05: job status updates with an audit log.
--
-- * technician_job_events: append-only log of status and assignee changes,
--   written only by a SECURITY DEFINER trigger (no INSERT policy).
-- * guard_technician_jobs_update: RLS cannot restrict columns, so without
--   it a technician could PATCH status/started_at/completed_at directly
--   (technician_jobs_update_technician allows every column on own rows).
--   Status columns change only inside change_technician_job_status();
--   booking_id is immutable; technician_id changes only by admin/ops and
--   only to an active technician.
-- * change_technician_job_status(): the only status-change entry point.
--   SECURITY INVOKER so technician_jobs RLS applies: a job the caller
--   cannot update is reported as not found.
--
-- Error codes:
--   42501  caller may not reassign a job
--   P0002  job not found (or hidden by RLS)
--   22023  a reason is required to cancel
--   55000  invalid transition, or a protected column was changed directly
--   JB001  new assignee is not an active technician
--   JB004  job status changed since the caller loaded it (stale)
--
-- Transitions:
--   assigned    -> in_progress   technician of the job, admin/ops (sets started_at)
--   in_progress -> completed     technician of the job, admin/ops (sets completed_at)
--   assigned | in_progress -> cancelled   admin/ops only, reason required
--   completed and cancelled are terminal.

-- -----------------------------------------------------------------------------
-- Audit log
-- -----------------------------------------------------------------------------
create table public.technician_job_events (
  id uuid primary key default gen_random_uuid(),
  technician_job_id uuid not null references public.technician_jobs(id) on delete restrict,
  user_id uuid references public.users(id) on delete set null,
  from_status technician_job_status,
  to_status technician_job_status not null,
  from_technician_id uuid references public.users(id) on delete set null,
  to_technician_id uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index technician_job_events_job_created_idx
  on public.technician_job_events (technician_job_id, created_at);

alter table public.technician_job_events enable row level security;

create policy "technician_job_events_select_admin_ops_manager"
  on public.technician_job_events for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "technician_job_events_select_technician"
  on public.technician_job_events for select
  to authenticated
  using (
    exists (
      select 1
        from public.technician_jobs tj
       where tj.id = technician_job_events.technician_job_id
         and tj.technician_id = (select auth.uid())
    )
  );

-- No INSERT/UPDATE/DELETE policy: events are written by the trigger below.
-- No partner_user policy: partner users have no access to job events.

-- Append-only. The one allowed update is the FK `on delete set null` action
-- nulling user_id / *_technician_id when a user is deleted (trigger depth > 1).
create function public.prevent_technician_job_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'technician_job_events is append-only' using errcode = '55000';
  end if;

  if pg_trigger_depth() > 1
     and (to_jsonb(new) - 'user_id' - 'from_technician_id' - 'to_technician_id')
       = (to_jsonb(old) - 'user_id' - 'from_technician_id' - 'to_technician_id')
     and (new.user_id is null or new.user_id = old.user_id)
     and (new.from_technician_id is null or new.from_technician_id = old.from_technician_id)
     and (new.to_technician_id is null or new.to_technician_id = old.to_technician_id) then
    return new;
  end if;

  raise exception 'technician_job_events is append-only' using errcode = '55000';
end;
$$;

revoke execute on function public.prevent_technician_job_event_mutation() from public;
revoke execute on function public.prevent_technician_job_event_mutation() from anon;

create trigger prevent_technician_job_events_update
  before update on public.technician_job_events
  for each row
  execute function public.prevent_technician_job_event_mutation();

create trigger prevent_technician_job_events_delete
  before delete on public.technician_job_events
  for each row
  execute function public.prevent_technician_job_event_mutation();

create trigger prevent_technician_job_events_truncate
  before truncate on public.technician_job_events
  for each statement
  execute function public.prevent_technician_job_event_mutation();

-- Writes one event per statement-level change of status and/or assignee.
-- SECURITY DEFINER so the audit row is written whatever the caller's RLS
-- context; user_id is resolved through public.users (FK) and may be null.
create function public.record_technician_job_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_notes text := nullif(btrim(current_setting('app.job_event_notes', true)), '');
begin
  select u.id
    into v_user_id
    from public.users u
   where u.id = auth.uid();

  insert into public.technician_job_events (
    technician_job_id, user_id, from_status, to_status,
    from_technician_id, to_technician_id, notes, created_at
  )
  values (
    new.id, v_user_id, old.status, new.status,
    old.technician_id, new.technician_id, v_notes, clock_timestamp()
  );

  return null;
end;
$$;

revoke execute on function public.record_technician_job_event() from public;
revoke execute on function public.record_technician_job_event() from anon;

create trigger record_technician_jobs_event_update
  after update of status, technician_id on public.technician_jobs
  for each row
  when (
    old.status is distinct from new.status
    or old.technician_id is distinct from new.technician_id
  )
  execute function public.record_technician_job_event();

-- -----------------------------------------------------------------------------
-- Guard against direct updates of protected columns
-- -----------------------------------------------------------------------------
create function public.guard_technician_job_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_in_rpc boolean :=
    coalesce(nullif(btrim(current_setting('app.job_status_change', true)), ''), 'off') = 'on';
begin
  if new.booking_id is distinct from old.booking_id then
    raise exception 'The booking of a job cannot be changed' using errcode = '55000';
  end if;

  if not v_in_rpc and (
    new.status is distinct from old.status
    or new.started_at is distinct from old.started_at
    or new.completed_at is distinct from old.completed_at
  ) then
    raise exception 'Job status can only be changed through change_technician_job_status()'
      using errcode = '55000';
  end if;

  if new.technician_id is distinct from old.technician_id then
    if not coalesce(public.is_admin_or_ops_manager(), false) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;

    if not exists (
      select 1
        from public.users u
       where u.id = new.technician_id
         and u.role = 'technician'
         and u.is_active
    ) then
      raise exception 'Technician is not active' using errcode = 'JB001';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_technician_job_update() from public;
revoke execute on function public.guard_technician_job_update() from anon;

create trigger guard_technician_jobs_update
  before update on public.technician_jobs
  for each row
  execute function public.guard_technician_job_update();

-- -----------------------------------------------------------------------------
-- change_technician_job_status()
-- p_from_status is the status the caller was looking at; a mismatch means
-- someone else changed the job first (JB004) instead of silently winning.
-- -----------------------------------------------------------------------------
create function public.change_technician_job_status(
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

revoke execute on function public.change_technician_job_status(uuid, public.technician_job_status, public.technician_job_status, text) from public;
revoke execute on function public.change_technician_job_status(uuid, public.technician_job_status, public.technician_job_status, text) from anon;
grant execute on function public.change_technician_job_status(uuid, public.technician_job_status, public.technician_job_status, text) to authenticated;

-- Rollback (run manually against the target database if needed):
-- drop function if exists public.change_technician_job_status(uuid, public.technician_job_status, public.technician_job_status, text);
-- drop trigger if exists guard_technician_jobs_update on public.technician_jobs;
-- drop function if exists public.guard_technician_job_update();
-- drop trigger if exists record_technician_jobs_event_update on public.technician_jobs;
-- drop function if exists public.record_technician_job_event();
-- drop trigger if exists prevent_technician_job_events_truncate on public.technician_job_events;
-- drop trigger if exists prevent_technician_job_events_delete on public.technician_job_events;
-- drop trigger if exists prevent_technician_job_events_update on public.technician_job_events;
-- drop function if exists public.prevent_technician_job_event_mutation();
-- drop policy if exists "technician_job_events_select_technician" on public.technician_job_events;
-- drop policy if exists "technician_job_events_select_admin_ops_manager" on public.technician_job_events;
-- drop table if exists public.technician_job_events;
