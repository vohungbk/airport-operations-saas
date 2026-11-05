-- VI-F09-S11: restrict invoice access (spec VI-F09 R15, E6).
--
-- invoice_partner_id() is SECURITY DEFINER and is granted to authenticated, so it is also an RPC. It returned
-- the partner_id of any invoice id it was given, so a partner user could ask for the invoice of another
-- partner and learn that it exists and who owns it (a different answer from an id that does not exist).
--
-- Now the function answers only for a caller who may see the invoice: an admin or an operations manager (any
-- invoice), or a partner user of the partner that owns it. For anyone else, and for an id that does not
-- exist, the answer is null, so the two cannot be told apart.
--
-- The policy of invoice_lines compares this value with current_user_partner_id(); null never equals it, so
-- the rows a role sees through that policy do not change. The grants stay as they are (create or replace).
--
-- Rollback: restore the previous body:
--   create or replace function public.invoice_partner_id(p_invoice_id uuid) returns uuid
--   language sql security definer stable set search_path = ''
--   as $$ select partner_id from public.invoices where id = p_invoice_id; $$;

create or replace function public.invoice_partner_id(p_invoice_id uuid)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select i.partner_id
  from public.invoices i
  where i.id = p_invoice_id
    and (
      (select public.is_admin_or_ops_manager())
      or i.partner_id = (select public.current_user_partner_id())
    );
$$;

comment on function public.invoice_partner_id(uuid) is
  'Returns the partner_id that owns the given invoice, bypassing invoices RLS via SECURITY DEFINER, so the policy of invoice_lines does not re-enter the policy of invoices (VI-F09-S03). Answers only for an admin, an operations manager or the partner user of the owning partner; null otherwise, the same as for an unknown id (VI-F09-S11).';
