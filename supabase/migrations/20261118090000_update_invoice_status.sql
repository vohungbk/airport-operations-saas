-- VI-F09-S08: update the payment status of an invoice by hand, with the actor, the time and, for a void, the reason
-- (spec VI-F09 F1, V1, R6, R16, E3, E7; Q4 is open, so the moves below are assumptions).
--
-- update_invoice_status() is SECURITY DEFINER and checks the caller itself (an active admin; the Server Action does the
-- same). It moves an invoice that is issued or overdue in one update. The allowed moves are:
--   issued  -> paid, overdue, void
--   overdue -> paid, void
-- Paid and void do not go on (a paid invoice is corrected with a new invoice, Q4). A draft is only issued by
-- issue_invoice() (VI-F09-S07). The same status again is a refused move too.
--   * Void needs a reason (1 to 1000 characters). The number, the amounts and the lines are not touched: the guards of
--     VI-F09-S07 keep them, so the number of a void invoice is kept.
--   * For paid and overdue the reason is optional.
--   * Who changed the status, when and why is kept by finance_history (spec R16): the actor is auth.uid(), the time is
--     the time of the change, and the reason is the one given (app.finance_reason, set for this transaction only), or
--     "Invoice status moved from X to Y" when none is given. No column is added.
--
-- guard_invoice_status_change() refuses a change of the status of an invoice that is not a draft outside the function
-- (the admin has an update policy on the table), the way guard_settlement_update() does for a settlement. A move back to
-- draft is left to guard_issued_invoice_update() (IV003). Moving a draft is left to issue_invoice() and is not guarded.
--
-- Error codes of update_invoice_status():
--   42501  the caller is not an active admin
--   22023  the invoice id or the new status is missing
--   P0002  the invoice does not exist
--   IV004  the move is not allowed
--   IV005  a void has no reason, or the reason is longer than 1000 characters
-- Error code of the guard: IV004.
--
-- No new table, so no new policy.
--
-- Rollback: drop trigger guard_invoice_status_change on public.invoices;
--   drop function public.guard_invoice_status_change();
--   drop function public.update_invoice_status(uuid, public.invoice_status, text);

create function public.guard_invoice_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft'
     and new.status <> 'draft'
     and new.status is distinct from old.status
     and coalesce(nullif(btrim(current_setting('app.invoice_status_change', true)), ''), 'off') <> 'on' then
    raise exception 'The status of an invoice can only be changed through update_invoice_status()'
      using errcode = 'IV004';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_invoice_status_change() from public;
revoke execute on function public.guard_invoice_status_change() from anon;

create trigger guard_invoice_status_change
  before update on public.invoices
  for each row
  execute function public.guard_invoice_status_change();

create function public.update_invoice_status(
  p_invoice_id uuid,
  p_to public.invoice_status,
  p_reason text default null
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_invoice public.invoices;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_row public.invoices;
begin
  select u.role
    into v_role
    from public.users u
   where u.id = v_uid
     and u.is_active;

  if v_role is distinct from 'admin' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_invoice_id is null or p_to is null then
    raise exception 'A value is missing' using errcode = '22023';
  end if;

  select *
    into v_invoice
    from public.invoices i
   where i.id = p_invoice_id
     for update;

  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;

  if not (
    (v_invoice.status = 'issued' and p_to in ('paid', 'overdue', 'void'))
    or (v_invoice.status = 'overdue' and p_to in ('paid', 'void'))
  ) then
    raise exception 'The invoice cannot move from % to %', v_invoice.status, p_to using errcode = 'IV004';
  end if;

  if (p_to = 'void' and v_reason is null) or char_length(coalesce(v_reason, '')) > 1000 then
    raise exception 'A void needs a reason of at most 1000 characters' using errcode = 'IV005';
  end if;

  perform set_config('app.invoice_status_change', 'on', true);
  perform set_config('app.finance_reason', coalesce(v_reason, ''), true);

  update public.invoices i
     set status = p_to
   where i.id = p_invoice_id
  returning * into v_row;

  perform set_config('app.invoice_status_change', '', true);
  perform set_config('app.finance_reason', '', true);

  return v_row;
end;
$$;

revoke execute on function public.update_invoice_status(uuid, public.invoice_status, text) from public;
revoke execute on function public.update_invoice_status(uuid, public.invoice_status, text) from anon;
grant execute on function public.update_invoice_status(uuid, public.invoice_status, text) to authenticated;
