-- VI-F09-S06: generate a draft invoice from an approved settlement (spec VI-F09 R7, R10, E1, E2).
--
-- generate_invoice() is SECURITY DEFINER and checks the caller itself (an active admin; the Server Action and
-- the page do the same). It reads the settlement of the partner and the month and creates, in one transaction,
-- a draft invoice and its lines:
--   * The settlement must be approved (IN002 otherwise, also when there is no settlement for the month).
--   * An invoice that is not void already made from the settlement is refused (IN003). The id of that invoice
--     is in the DETAIL of the error, so the screen can show it. The settlement row is locked first, and a
--     partial unique index is the second wall, so two calls at once make one invoice.
--   * The lines are the figures of the settlement: the gross revenue and the partner share (they only show
--     where the subtotal comes from), the platform share and the fees (they are the subtotal). The fees
--     line is written only when it is above zero. Subtotal = platform share + fees; VAT = 5 percent of the
--     subtotal, rounded to the cent (assumption: the spec gives no rate; it is the rate of the design);
--     total = subtotal + VAT.
--   * The invoice is a draft (a partner sees an invoice only once it is issued). The issue date is the first
--     day after the month, the due date is 30 days later (payment terms of the design; assumption).
--   * The number is INV-YYYY-NNNNNN. YYYY is the year of the issue date and NNNNNN counts from 000001 again
--     each year (spec Q5, assumption). It is the highest number of that year plus one, taken under a lock
--     for the year. The number column is unique, and an invoice is never deleted (a trigger refuses it for
--     the app roles; a wrong invoice is voided), so a number is never used twice.
--
-- Error codes of generate_invoice():
--   42501  the caller is not an active admin
--   22023  the partner or the month is missing
--   P0002  the partner does not exist
--   IN002  the month has no approved settlement
--   IN003  an invoice already exists for the settlement (DETAIL = its id)
--
-- No new table, so no new policy. An invoice is written by an admin only (policy invoices_insert_admin), and
-- invoice_lines has no insert policy: this function is the only way to write a line.
--
-- Rollback: drop function public.generate_invoice(uuid, date);
--   drop index public.invoices_settlement_id_open_key;

create unique index invoices_settlement_id_open_key
  on public.invoices(settlement_id)
  where settlement_id is not null and status <> 'void';

create function public.generate_invoice(p_partner_id uuid, p_month date)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_start date;
  v_settlement public.settlements;
  v_existing uuid;
  v_subtotal numeric(12,2);
  v_vat numeric(12,2);
  v_issue date;
  v_year text;
  v_next integer;
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

  if p_partner_id is null or p_month is null then
    raise exception 'A value is missing' using errcode = '22023';
  end if;

  perform 1 from public.partners p where p.id = p_partner_id;
  if not found then
    raise exception 'Partner not found' using errcode = 'P0002';
  end if;

  v_start := date_trunc('month', p_month)::date;

  select *
    into v_settlement
    from public.settlements s
   where s.partner_id = p_partner_id
     and s.period_start = v_start
     for update;

  if not found or v_settlement.status <> 'approved' then
    raise exception 'The month has no approved settlement' using errcode = 'IN002';
  end if;

  select i.id
    into v_existing
    from public.invoices i
   where i.settlement_id = v_settlement.id
     and i.status <> 'void'
   limit 1;

  if found then
    raise exception 'An invoice already exists for this settlement'
      using errcode = 'IN003', detail = v_existing::text;
  end if;

  v_subtotal := v_settlement.platform_share + v_settlement.fees;
  v_vat := round(v_subtotal * 0.05, 2);
  v_issue := (v_start + interval '1 month')::date;
  v_year := to_char(v_issue, 'YYYY');

  perform pg_advisory_xact_lock(hashtext('invoice_number_' || v_year));

  select coalesce(max(substring(i.invoice_number from '[0-9]+$')::integer), 0) + 1
    into v_next
    from public.invoices i
   where i.invoice_number like 'INV-' || v_year || '-%';

  insert into public.invoices (
    partner_id, settlement_id, invoice_number, issue_date, due_date, subtotal, vat, total, status
  )
  values (
    p_partner_id, v_settlement.id, 'INV-' || v_year || '-' || lpad(v_next::text, 6, '0'),
    v_issue, v_issue + 30, v_subtotal, v_vat, v_subtotal + v_vat, 'draft'
  )
  returning * into v_row;

  insert into public.invoice_lines (invoice_id, position, description, amount, counts_toward_subtotal)
  select v_row.id, l.position, l.description, l.amount, l.counts
    from (values
      (1, 'Gross revenue', v_settlement.gross_revenue, false),
      (2, 'Partner share', v_settlement.partner_share, false),
      (3, 'Platform share', v_settlement.platform_share, true),
      (4, 'Fees', v_settlement.fees, true)
    ) as l(position, description, amount, counts)
   where l.position < 4 or l.amount > 0;

  return v_row;
end;
$$;

revoke execute on function public.generate_invoice(uuid, date) from public;
revoke execute on function public.generate_invoice(uuid, date) from anon;
grant execute on function public.generate_invoice(uuid, date) to authenticated;
