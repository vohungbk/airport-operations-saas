-- VI-F09-S10: the history of invoices and of their status changes (spec VI-F09 R9, R16).
--
-- The history is finance_history (VI-F04-S16): append-only, with the actor, the time and the reason of every change,
-- and invoices are never deleted. Only an admin and an operations manager can read that table, so a partner user
-- cannot read it. get_invoice_history() is the read for the Invoice history screen. It is SECURITY DEFINER and answers
-- for these callers only:
--   * an admin or an operations manager: every invoice.
--   * a partner user (an active one of an active partner): its own partner's invoices that are now issued, paid or
--     overdue, and only the events that moved an invoice to issued, paid or overdue. The creation of the draft and the
--     moves to draft or void are internal and are not returned (the design: "Draft/Void events are withheld"). The
--     rule is here and not in the screen.
--   * anyone else (a technician, no session, a partner user with no active partner): error 42501.
--
-- An event is the creation of an invoice (insert) or a change of its status. Other changes (for example the dates, kept
-- in the same update as the issue) are not events of their own. Each row has the invoice, the status before (null for
-- the creation) and after, the reason finance_history kept, the name of the actor (null when the database made the
-- change, for example an invoice that became overdue by itself) and the time, oldest first.
--   * p_invoice_id limits it to one invoice; an invoice the caller may not see gives no rows (the same as one that
--     does not exist).
--   * p_year limits it to the events of that calendar year in the time zone of the screen (Asia/Dubai, GST).
--
-- No new table, so no new policy; finance_history keeps its own policy and the grants stay as they are.
--
-- Error codes: 42501  the caller may not read the history.
--
-- Rollback: drop function public.get_invoice_history(uuid, integer);

create function public.get_invoice_history(
  p_invoice_id uuid default null,
  p_year integer default null
)
returns table (
  id uuid,
  invoice_id uuid,
  invoice_number text,
  from_status text,
  to_status text,
  reason text,
  actor_name text,
  changed_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_internal boolean := (select public.is_admin_or_ops_manager());
  v_partner uuid := (select public.current_user_partner_id());
begin
  if not v_internal and v_partner is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select h.id,
         h.row_id,
         i.invoice_number,
         h.old_values ->> 'status',
         h.new_values ->> 'status',
         h.reason,
         u.full_name,
         h.changed_at
    from public.finance_history h
    join public.invoices i on i.id = h.row_id
    left join public.users u on u.id = h.changed_by
   where h.table_name = 'invoices'
     and (h.action = 'insert' or h.new_values ? 'status')
     and (p_invoice_id is null or h.row_id = p_invoice_id)
     and (p_year is null or extract(year from h.changed_at at time zone 'Asia/Dubai') = p_year)
     and (
       v_internal
       or (
         i.partner_id = v_partner
         and i.status in ('issued', 'overdue', 'paid')
         and h.new_values ->> 'status' in ('issued', 'overdue', 'paid')
       )
     )
   order by h.changed_at, h.id;
end;
$$;

revoke execute on function public.get_invoice_history(uuid, integer) from public;
revoke execute on function public.get_invoice_history(uuid, integer) from anon;
grant execute on function public.get_invoice_history(uuid, integer) to authenticated;
