-- FO-F05-S06: move an incident through statuses, with an audit log.
--
-- * incident_status_history: append-only log of status changes, written only
--   by a SECURITY DEFINER trigger (no INSERT policy). Read by admin/ops only
--   until incident access is scoped for other roles (FO-F05-S07).
-- * guard_incident_status_update: RLS cannot restrict columns, and the admin
--   UPDATE policy allows every column, so without it a status could be
--   PATCHed directly with no rules and no history. status, resolved_by and
--   resolved_at change only inside change_incident_status().
-- * change_incident_status(): the only status-change entry point. SECURITY
--   DEFINER, because the UPDATE policy is admin-only and the operations
--   manager has to be able to do this; it checks the caller itself (an active
--   admin or operations manager). The UPDATE policy is not widened.
--
-- Error codes:
--   42501  the caller is not an active admin or operations manager
--   P0002  incident not found
--   22023  a status is missing, or a note is required (reopening) or too long
--   55000  invalid transition, or a protected column was changed directly
--   JB004  the incident status changed since the caller loaded it (stale)
--
-- Transitions (closed is terminal):
--   open          -> investigating | resolved
--   investigating -> resolved
--   resolved      -> closed
--   resolved      -> investigating   reopening; a note is required
--
-- resolved_by / resolved_at are set when the incident becomes resolved and
-- cleared when it is reopened; closing keeps them.

-- -----------------------------------------------------------------------------
-- Audit log
-- -----------------------------------------------------------------------------
create table public.incident_status_history (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete restrict,
  user_id uuid references public.users(id) on delete set null,
  from_status incident_status,
  to_status incident_status not null,
  notes text,
  created_at timestamptz not null default now()
);

create index incident_status_history_incident_created_idx
  on public.incident_status_history (incident_id, created_at);

alter table public.incident_status_history enable row level security;

create policy "incident_status_history_select_admin_ops_manager"
  on public.incident_status_history for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

-- No INSERT/UPDATE/DELETE policy: history is written by the trigger below.
-- No technician or partner policy until FO-F05-S07 scopes incident access.

-- Append-only. The one allowed update is the FK `on delete set null` action
-- nulling user_id when a user is deleted (trigger depth > 1).
create function public.prevent_incident_status_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'incident_status_history is append-only' using errcode = '55000';
  end if;

  if pg_trigger_depth() > 1
     and (to_jsonb(new) - 'user_id') = (to_jsonb(old) - 'user_id')
     and (new.user_id is null or new.user_id = old.user_id) then
    return new;
  end if;

  raise exception 'incident_status_history is append-only' using errcode = '55000';
end;
$$;

revoke execute on function public.prevent_incident_status_history_mutation() from public;
revoke execute on function public.prevent_incident_status_history_mutation() from anon;

create trigger prevent_incident_status_history_update
  before update on public.incident_status_history
  for each row
  execute function public.prevent_incident_status_history_mutation();

create trigger prevent_incident_status_history_delete
  before delete on public.incident_status_history
  for each row
  execute function public.prevent_incident_status_history_mutation();

create trigger prevent_incident_status_history_truncate
  before truncate on public.incident_status_history
  for each statement
  execute function public.prevent_incident_status_history_mutation();

-- One row per status change. SECURITY DEFINER so the audit row is written
-- whatever the caller's RLS context; user_id is resolved through public.users
-- (FK) and may be null.
create function public.record_incident_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_notes text := nullif(btrim(current_setting('app.incident_status_notes', true)), '');
begin
  select u.id
    into v_user_id
    from public.users u
   where u.id = auth.uid();

  insert into public.incident_status_history (
    incident_id, user_id, from_status, to_status, notes, created_at
  )
  values (
    new.id, v_user_id, old.status, new.status, v_notes, clock_timestamp()
  );

  return null;
end;
$$;

revoke execute on function public.record_incident_status_change() from public;
revoke execute on function public.record_incident_status_change() from anon;

create trigger record_incidents_status_change
  after update of status on public.incidents
  for each row
  when (old.status is distinct from new.status)
  execute function public.record_incident_status_change();

-- -----------------------------------------------------------------------------
-- Guard against direct updates of the status columns
-- -----------------------------------------------------------------------------
create function public.guard_incident_status_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(nullif(btrim(current_setting('app.incident_status_change', true)), ''), 'off') = 'on' then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.resolved_by is distinct from old.resolved_by
     or new.resolved_at is distinct from old.resolved_at then
    raise exception 'Incident status can only be changed through change_incident_status()'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_incident_status_update() from public;
revoke execute on function public.guard_incident_status_update() from anon;

create trigger guard_incidents_status_update
  before update on public.incidents
  for each row
  execute function public.guard_incident_status_update();

-- -----------------------------------------------------------------------------
-- change_incident_status()
-- p_from_status is the status the caller was looking at; a mismatch means
-- someone else changed the incident first (JB004) instead of silently winning.
-- -----------------------------------------------------------------------------
create function public.change_incident_status(
  p_incident_id uuid,
  p_from_status public.incident_status,
  p_to_status public.incident_status,
  p_note text default null
)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_incident public.incidents;
  v_note text := nullif(btrim(p_note), '');
  v_reopening boolean;
begin
  select u.role
    into v_role
    from public.users u
   where u.id = v_uid
     and u.is_active;

  if v_role is null or v_role not in ('admin', 'operations_manager') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_from_status is null or p_to_status is null then
    raise exception 'A status is required' using errcode = '22023';
  end if;

  select *
    into v_incident
    from public.incidents i
   where i.id = p_incident_id
     for update;

  if not found then
    raise exception 'Incident not found' using errcode = 'P0002';
  end if;

  if v_incident.status is distinct from p_from_status then
    raise exception 'Incident was changed by someone else' using errcode = 'JB004';
  end if;

  if not (
    (v_incident.status = 'open' and p_to_status in ('investigating', 'resolved'))
    or (v_incident.status = 'investigating' and p_to_status = 'resolved')
    or (v_incident.status = 'resolved' and p_to_status in ('closed', 'investigating'))
  ) then
    raise exception 'Invalid incident status transition: % -> %', v_incident.status, p_to_status
      using errcode = '55000';
  end if;

  v_reopening := v_incident.status = 'resolved' and p_to_status = 'investigating';

  if v_reopening and v_note is null then
    raise exception 'A note is required to reopen an incident' using errcode = '22023';
  end if;

  if char_length(coalesce(v_note, '')) > 500 then
    raise exception 'The note is too long' using errcode = '22023';
  end if;

  perform set_config('app.incident_status_notes', coalesce(v_note, ''), true);
  perform set_config('app.incident_status_change', 'on', true);

  update public.incidents i
     set status = p_to_status,
         resolved_by = case
           when p_to_status = 'resolved' then v_uid
           when v_reopening then null
           else i.resolved_by
         end,
         resolved_at = case
           when p_to_status = 'resolved' then now()
           when v_reopening then null
           else i.resolved_at
         end
   where i.id = p_incident_id
  returning i.* into v_incident;

  perform set_config('app.incident_status_notes', '', true);
  perform set_config('app.incident_status_change', '', true);

  return v_incident;
end;
$$;

revoke execute on function public.change_incident_status(uuid, public.incident_status, public.incident_status, text) from public;
revoke execute on function public.change_incident_status(uuid, public.incident_status, public.incident_status, text) from anon;
grant execute on function public.change_incident_status(uuid, public.incident_status, public.incident_status, text) to authenticated;

-- Rollback (run manually against the target database if needed):
-- drop function if exists public.change_incident_status(uuid, public.incident_status, public.incident_status, text);
-- drop trigger if exists guard_incidents_status_update on public.incidents;
-- drop function if exists public.guard_incident_status_update();
-- drop trigger if exists record_incidents_status_change on public.incidents;
-- drop function if exists public.record_incident_status_change();
-- drop trigger if exists prevent_incident_status_history_truncate on public.incident_status_history;
-- drop trigger if exists prevent_incident_status_history_delete on public.incident_status_history;
-- drop trigger if exists prevent_incident_status_history_update on public.incident_status_history;
-- drop function if exists public.prevent_incident_status_history_mutation();
-- drop policy if exists "incident_status_history_select_admin_ops_manager" on public.incident_status_history;
-- drop table if exists public.incident_status_history;
