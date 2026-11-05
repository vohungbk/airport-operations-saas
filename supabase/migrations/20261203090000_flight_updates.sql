-- VI-F02-S03: refresh flight data (spec VI-F02 R7, R12, R13, R15).
--
-- flight_updates is the history of a flight: every change of its data is kept with the time and the source, and
-- nothing is deleted or changed afterwards (R13). One row is one refresh that changed something; `changes` is the list
-- of what moved ([{ "field": "estimated_arrival_at", "from": "...", "to": "..." }]), so a refresh that changed nothing
-- writes no row. `source` is who made the change: provider (the live provider), system (sandbox data or the
-- simulator), manual (operations entered it, VI-F02-S06). Nothing here writes "manual"; the column allows it.
--
-- Read access follows who may see the flight (R15), the way booking_events does:
--   * admin and operations manager: every flight.
--   * partner user: the flights of the bookings of its own partner.
--   * technician: the flights of the bookings it is assigned to, or has a job on.
-- There is no insert, update or delete policy: no signed-in user writes this table. The only writer is
-- apply_flight_refresh(), which is for the system (the service role) and never an endpoint a person can call. A trigger
-- also refuses update, delete and truncate for every role, so the history cannot be rewritten by the job either.
--
-- apply_flight_refresh() writes one refresh in one transaction: it sets the new values and the sync time on the flight
-- and adds the history row when something changed. The job that calls it has no signed-in user, so it runs with the
-- service role (see docs/security.md); the function is the only thing that role is used for here.
-- The job reads the flight, asks the source, and then writes; p_expected_synced_at is the sync time it read. When the
-- flight has been refreshed by another run in between (the sync time moved), nothing is written and the function
-- returns false, so two overlapping runs cannot write the same change twice or a history row with a wrong "from".
--
-- Error codes: 22023  a value is missing or not allowed.   P0002  the flight does not exist.
--
-- Rollback:
--   drop function public.apply_flight_refresh(uuid, jsonb, jsonb, text, timestamptz);
--   drop table public.flight_updates;
--   drop function public.prevent_flight_update_mutation();

create table public.flight_updates (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid not null references public.flights(id) on delete restrict,
  source text not null check (source in ('provider', 'system', 'manual')),
  changes jsonb not null
    check (jsonb_typeof(changes) = 'array' and jsonb_array_length(changes) > 0),
  occurred_at timestamptz not null default now()
);

create index flight_updates_flight_idx on public.flight_updates(flight_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- Append only, for every role.
-- -----------------------------------------------------------------------------
create function public.prevent_flight_update_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'flight_updates is append-only' using errcode = '55000';
end;
$$;

revoke execute on function public.prevent_flight_update_mutation() from public;
revoke execute on function public.prevent_flight_update_mutation() from anon;

create trigger prevent_flight_updates_update
  before update on public.flight_updates
  for each row
  execute function public.prevent_flight_update_mutation();

create trigger prevent_flight_updates_delete
  before delete on public.flight_updates
  for each row
  execute function public.prevent_flight_update_mutation();

create trigger prevent_flight_updates_truncate
  before truncate on public.flight_updates
  for each statement
  execute function public.prevent_flight_update_mutation();

-- -----------------------------------------------------------------------------
-- RLS: read only, by who may see the flight.
-- -----------------------------------------------------------------------------
alter table public.flight_updates enable row level security;

create policy "flight_updates_select_admin_ops_manager"
  on public.flight_updates for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "flight_updates_select_technician"
  on public.flight_updates for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.flight_id = flight_updates.flight_id
        and (
          b.assigned_technician_id = (select auth.uid())
          or exists (
            select 1
            from public.technician_jobs tj
            where tj.booking_id = b.id
              and tj.technician_id = (select auth.uid())
          )
        )
    )
  );

create policy "flight_updates_select_partner_user"
  on public.flight_updates for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.flight_id = flight_updates.flight_id
        and b.partner_id = (select public.current_user_partner_id())
    )
  );

-- -----------------------------------------------------------------------------
-- apply_flight_refresh(): one refresh, for the system only.
-- -----------------------------------------------------------------------------
create function public.apply_flight_refresh(
  p_flight_id uuid,
  p_values jsonb,
  p_changes jsonb,
  p_source text,
  p_expected_synced_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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

  update public.flights
     set status = (p_values ->> 'status')::public.flight_status,
         estimated_arrival_at = (p_values ->> 'estimated_arrival_at')::timestamptz,
         actual_arrival_at = (p_values ->> 'actual_arrival_at')::timestamptz,
         terminal = p_values ->> 'terminal',
         delay_minutes = (p_values ->> 'delay_minutes')::integer,
         provider = p_values ->> 'provider',
         last_synced_at = now()
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
    insert into public.flight_updates (flight_id, source, changes)
    values (p_flight_id, p_source, p_changes);
  end if;

  return true;
end;
$$;

revoke execute on function public.apply_flight_refresh(uuid, jsonb, jsonb, text, timestamptz) from public;
revoke execute on function public.apply_flight_refresh(uuid, jsonb, jsonb, text, timestamptz) from anon;
revoke execute on function public.apply_flight_refresh(uuid, jsonb, jsonb, text, timestamptz) from authenticated;
grant execute on function public.apply_flight_refresh(uuid, jsonb, jsonb, text, timestamptz) to service_role;
