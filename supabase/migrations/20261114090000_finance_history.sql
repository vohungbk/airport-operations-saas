-- VI-F04-S16: keep every financial change with who made it, when and why, and never delete the
-- history (spec VI-F04 R16).
--
-- finance_history is one append-only log for the three tables whose values are money: settlements,
-- invoices and partner_commercial_terms. A trigger writes a row after every insert and every
-- update that changes a value (created_at and updated_at are bookkeeping, not values: they are not kept
-- and a change of them alone is not a change): the table, the row,
-- the partner, insert or update, the actor (auth.uid(), null when the database itself or the
-- service role made the change), the time, the reason, and the columns that changed (old and new).
-- Nobody writes to it directly: there is no insert, update or delete policy and the grants are
-- revoked. It cannot be updated, deleted or truncated by any role, the service role included. It
-- keeps no foreign key to the rows it describes, so it stays whole when one of them is removed.
--
-- The reason is worked out from what changed, so no existing function had to change:
--   settlement inserted         Settlement generated for YYYY-MM
--   settlement status changed   Status moved from X to Y
--   other settlement change     Settlement figures changed
--   terms inserted              Commercial terms version saved
--   launch fields of the terms  Launch credit updated by a completed rental
--   effective_to of the terms   Previous terms version closed by a new version
--   other terms change          Commercial terms changed
--   invoice inserted            Invoice created
--   invoice status changed      Invoice status moved from X to Y
--   other invoice change        Invoice changed
-- A writer that has a reason of its own (a future screen with a typed reason) sets
-- app.finance_reason for the transaction (set_config(..., true)); it wins over the one above.
-- Admin and operations manager read the log; a partner user and a technician read nothing.
--
-- The finance rows themselves are protected from deletion for the app roles (anon and
-- authenticated) by a trigger, as a second wall behind the missing delete policy: if a delete
-- policy is ever added, the rows still cannot go. The database owner and the service role can still
-- remove rows (tests and demo data use it); the log of what they held stays.
--
-- The reason is never empty and at most 1000 characters (the same limit as an adjustment).
--
-- Rollback: drop trigger record_finance_change_settlements on public.settlements;
--   drop trigger record_finance_change_invoices on public.invoices;
--   drop trigger record_finance_change_partner_commercial_terms on public.partner_commercial_terms;
--   drop function public.record_finance_change();
--   drop trigger prevent_finance_delete on public.settlements; (and on invoices,
--     partner_commercial_terms, settlement_carried_adjustments)
--   drop function public.prevent_finance_row_delete();
--   drop table public.finance_history; drop function public.prevent_finance_history_mutation();

create table public.finance_history (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  row_id uuid not null,
  partner_id uuid,
  action text not null,
  changed_by uuid references public.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  reason text not null,
  old_values jsonb,
  new_values jsonb not null,
  constraint finance_history_table_check
    check (table_name in ('settlements', 'invoices', 'partner_commercial_terms')),
  constraint finance_history_action_check check (action in ('insert', 'update')),
  constraint finance_history_reason_check
    check (btrim(reason) <> '' and char_length(reason) <= 1000)
);

create index finance_history_row_idx on public.finance_history(table_name, row_id, changed_at);
create index finance_history_partner_idx on public.finance_history(partner_id, changed_at);

-- -----------------------------------------------------------------------------
-- Append only, for every role.
-- -----------------------------------------------------------------------------
create function public.prevent_finance_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'finance_history is append-only' using errcode = '55000';
  end if;

  -- The only change allowed: the action "on delete set null" that clears changed_by when a user is
  -- deleted (it runs as a nested trigger).
  if pg_trigger_depth() > 1
     and new.changed_by is null
     and (to_jsonb(new) - 'changed_by') = (to_jsonb(old) - 'changed_by') then
    return new;
  end if;

  raise exception 'finance_history is append-only' using errcode = '55000';
end;
$$;

revoke execute on function public.prevent_finance_history_mutation() from public;
revoke execute on function public.prevent_finance_history_mutation() from anon;

create trigger prevent_finance_history_update
  before update on public.finance_history
  for each row
  execute function public.prevent_finance_history_mutation();

create trigger prevent_finance_history_delete
  before delete on public.finance_history
  for each row
  execute function public.prevent_finance_history_mutation();

create trigger prevent_finance_history_truncate
  before truncate on public.finance_history
  for each statement
  execute function public.prevent_finance_history_mutation();

alter table public.finance_history enable row level security;

revoke insert, update, delete, truncate on public.finance_history from anon, authenticated;

-- Admin and operations manager read the log. There is no insert, update or delete policy: only the
-- trigger below writes.
create policy "finance_history_select_admin_ops_manager"
  on public.finance_history for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

-- -----------------------------------------------------------------------------
-- The trigger that writes the log.
-- -----------------------------------------------------------------------------
create function public.record_finance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := to_jsonb(new) - 'created_at' - 'updated_at';
  v_old jsonb;
  v_changed jsonb;
  v_before jsonb;
  v_reason text := nullif(btrim(coalesce(current_setting('app.finance_reason', true), '')), '');
  v_action text := lower(tg_op);
begin
  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old) - 'created_at' - 'updated_at';

    select jsonb_object_agg(n.key, n.value), jsonb_object_agg(n.key, v_old -> n.key)
      into v_changed, v_before
      from jsonb_each(v_new) n
     where v_old -> n.key is distinct from n.value;

    -- Nothing but created_at or updated_at changed: not a financial change.
    if v_changed is null then
      return new;
    end if;
  else
    v_changed := v_new;
  end if;

  if v_reason is null then
    v_reason := case tg_table_name
      when 'settlements' then
        case
          when tg_op = 'INSERT' then 'Settlement generated for ' || to_char((v_new ->> 'period_start')::date, 'YYYY-MM')
          when v_changed ? 'status' then 'Status moved from ' || (v_before ->> 'status') || ' to ' || (v_changed ->> 'status')
          else 'Settlement figures changed'
        end
      when 'partner_commercial_terms' then
        case
          when tg_op = 'INSERT' then 'Commercial terms version saved'
          when (select bool_and(k in ('launch_credit_accumulated', 'launch_mode')) from jsonb_object_keys(v_changed) k)
            then 'Launch credit updated by a completed rental'
          when (select bool_and(k = 'effective_to') from jsonb_object_keys(v_changed) k)
            then 'Previous terms version closed by a new version'
          else 'Commercial terms changed'
        end
      else
        case
          when tg_op = 'INSERT' then 'Invoice created'
          when v_changed ? 'status' then 'Invoice status moved from ' || (v_before ->> 'status') || ' to ' || (v_changed ->> 'status')
          else 'Invoice changed'
        end
    end;
  end if;

  insert into public.finance_history (table_name, row_id, partner_id, action, changed_by, reason, old_values, new_values)
  values (
    tg_table_name,
    (v_new ->> 'id')::uuid,
    (v_new ->> 'partner_id')::uuid,
    v_action,
    auth.uid(),
    left(v_reason, 1000),
    v_before,
    v_changed
  );

  return new;
end;
$$;

revoke execute on function public.record_finance_change() from public;
revoke execute on function public.record_finance_change() from anon;

create trigger record_finance_change_settlements
  after insert or update on public.settlements
  for each row
  execute function public.record_finance_change();

create trigger record_finance_change_invoices
  after insert or update on public.invoices
  for each row
  execute function public.record_finance_change();

create trigger record_finance_change_partner_commercial_terms
  after insert or update on public.partner_commercial_terms
  for each row
  execute function public.record_finance_change();

-- -----------------------------------------------------------------------------
-- The finance rows are not deleted by the app roles (they have no TRUNCATE privilege).
-- -----------------------------------------------------------------------------
create function public.prevent_finance_row_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception '% rows are never deleted', tg_table_name using errcode = '55000';
  end if;

  return old;
end;
$$;

revoke execute on function public.prevent_finance_row_delete() from public;
revoke execute on function public.prevent_finance_row_delete() from anon;

create trigger prevent_finance_delete
  before delete on public.settlements
  for each row
  execute function public.prevent_finance_row_delete();

create trigger prevent_finance_delete
  before delete on public.invoices
  for each row
  execute function public.prevent_finance_row_delete();

create trigger prevent_finance_delete
  before delete on public.partner_commercial_terms
  for each row
  execute function public.prevent_finance_row_delete();

create trigger prevent_finance_delete
  before delete on public.settlement_carried_adjustments
  for each row
  execute function public.prevent_finance_row_delete();
