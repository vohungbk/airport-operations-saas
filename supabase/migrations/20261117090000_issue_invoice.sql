-- VI-F09-S07: issue a draft invoice with its due date, and keep an issued invoice as it was (spec VI-F09 R8, R11, R13).
--
-- issue_invoice() is SECURITY DEFINER and checks the caller itself (an active admin; the Server Action does the
-- same). It moves a draft invoice to issued in one update:
--   * The issue date is today (UTC, the date the database calls today). The draft carried a placeholder date.
--   * The due date is the issue date plus the payment terms of the partner: payment_terms_days of the version of
--     its commercial terms in force on that day, or 14 days when the partner has no terms in force (spec R11,
--     assumption: 14 is the default of the terms).
--   * An invoice that is not a draft (issued, paid, overdue, void) is refused (IV002), so an issued invoice is
--     never issued again and its due date is never moved. The row is locked first, so two calls at once issue it
--     once.
--   The change of the status is kept by finance_history (Invoice status moved from draft to issued, and who).
--
-- Once an invoice is not a draft, its amounts and its lines cannot change (spec R13; corrections are made with a
-- new invoice, Q4):
--   * guard_issued_invoice_update() refuses a change of the partner, the settlement, the number, the dates, the
--     subtotal, the VAT or the total (IV003), and a move back to draft (that would unlock them). The status can
--     still move between issued, paid, overdue and void (other stories).
--   * guard_invoice_line_change() refuses to insert, update or delete a line of an invoice that is not a draft
--     (IV003). generate_invoice() writes the lines while the invoice is a draft.
--
-- Error codes of issue_invoice():
--   42501  the caller is not an active admin
--   22023  the invoice id is missing
--   P0002  the invoice does not exist
--   IV002  the invoice is not a draft
-- Error code of the two guards: IV003 (an invoice that is not a draft cannot change).
--
-- No new table, so no new policy. issue_invoice() is the only way the app moves a draft to issued.
--
-- Rollback: drop trigger guard_invoice_line_change on public.invoice_lines;
--   drop trigger guard_issued_invoice_update on public.invoices;
--   drop function public.guard_invoice_line_change(); drop function public.guard_issued_invoice_update();
--   drop function public.issue_invoice(uuid);

create function public.guard_issued_invoice_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft'
     and (new.status = 'draft'
          or new.partner_id is distinct from old.partner_id
          or new.settlement_id is distinct from old.settlement_id
          or new.invoice_number is distinct from old.invoice_number
          or new.issue_date is distinct from old.issue_date
          or new.due_date is distinct from old.due_date
          or new.subtotal is distinct from old.subtotal
          or new.vat is distinct from old.vat
          or new.total is distinct from old.total) then
    raise exception 'An invoice that is not a draft cannot change' using errcode = 'IV003';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_issued_invoice_update() from public;
revoke execute on function public.guard_issued_invoice_update() from anon;

create trigger guard_issued_invoice_update
  before update on public.invoices
  for each row
  execute function public.guard_issued_invoice_update();

create function public.guard_invoice_line_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := case tg_op
    when 'INSERT' then array[new.invoice_id]
    when 'DELETE' then array[old.invoice_id]
    else array[old.invoice_id, new.invoice_id]
  end;
begin
  if exists (
    select 1
      from public.invoices i
     where i.id = any (v_ids)
       and i.status <> 'draft'
  ) then
    raise exception 'The lines of an invoice that is not a draft cannot change' using errcode = 'IV003';
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.guard_invoice_line_change() from public;
revoke execute on function public.guard_invoice_line_change() from anon;

create trigger guard_invoice_line_change
  before insert or update or delete on public.invoice_lines
  for each row
  execute function public.guard_invoice_line_change();

create function public.issue_invoice(p_invoice_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_invoice public.invoices;
  v_today date := (now() at time zone 'UTC')::date;
  v_days integer;
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

  if p_invoice_id is null then
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

  if v_invoice.status <> 'draft' then
    raise exception 'The invoice is not a draft' using errcode = 'IV002';
  end if;

  select t.payment_terms_days
    into v_days
    from public.partner_commercial_terms t
   where t.partner_id = v_invoice.partner_id
     and t.effective_from <= v_today
     and (t.effective_to is null or t.effective_to >= v_today)
   order by t.effective_from desc
   limit 1;

  update public.invoices
     set issue_date = v_today,
         due_date = v_today + coalesce(v_days, 14),
         status = 'issued'
   where id = p_invoice_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.issue_invoice(uuid) from public;
revoke execute on function public.issue_invoice(uuid) from anon;
grant execute on function public.issue_invoice(uuid) to authenticated;
