-- VI-F09-S09: an invoice that is issued and not paid becomes overdue once its due date has passed (spec VI-F09 R12).
--
-- mark_overdue_invoices() is SECURITY DEFINER and is for the system only: nobody who signs in can call it (execute is
-- revoked from public, anon and authenticated), so it is never an endpoint. It moves every invoice that is issued and
-- whose due date is before p_today to overdue in one update, and returns how many it moved.
--   * p_today is today in UTC (the date the database calls today, like issue_invoice()). An invoice is overdue from the
--     day after its due date: one that is due today is still issued.
--   * Only an issued invoice moves. A draft, a paid, a void and an overdue invoice are left as they are (an overdue
--     invoice is not written again, so it makes no history row).
--   * The move goes through guard_invoice_status_change() the way update_invoice_status() does (app.invoice_status_change),
--     so the amounts, the lines, the number and the dates are still guarded by VI-F09-S07.
--   * Finance history keeps the change: no actor (the database made it, so changed_by is null), the time of the change,
--     and the reason "Invoice passed its due date" (app.finance_reason, set for this transaction only).
--
-- Scheduling: when the pg_cron extension is available, the function runs every day at 00:05 UTC. When it is not, the
-- migration still succeeds and the function can be run by the database owner. Scheduling again with the same name
-- replaces the job.
--
-- No new table, so no new policy.
--
-- Rollback: select cron.unschedule('mark-overdue-invoices'); (only if pg_cron is installed)
--   drop function public.mark_overdue_invoices(date);

create function public.mark_overdue_invoices(
  p_today date default (now() at time zone 'UTC')::date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_today is null then
    raise exception 'A value is missing' using errcode = '22023';
  end if;

  perform set_config('app.invoice_status_change', 'on', true);
  perform set_config('app.finance_reason', 'Invoice passed its due date', true);

  update public.invoices i
     set status = 'overdue'
   where i.status = 'issued'
     and i.due_date < p_today;

  get diagnostics v_count = row_count;

  perform set_config('app.invoice_status_change', '', true);
  perform set_config('app.finance_reason', '', true);

  return v_count;
end;
$$;

revoke execute on function public.mark_overdue_invoices(date) from public;
revoke execute on function public.mark_overdue_invoices(date) from anon;
revoke execute on function public.mark_overdue_invoices(date) from authenticated;

do $schedule$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('mark-overdue-invoices', '5 0 * * *', 'select public.mark_overdue_invoices()');
  end if;
exception when others then
  raise notice 'mark-overdue-invoices was not scheduled: %', sqlerrm;
end
$schedule$;
