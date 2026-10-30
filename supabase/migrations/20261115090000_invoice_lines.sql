-- VI-F09-S03: the lines of an invoice (spec VI-F09 R3), for the invoice detail screen.
--
-- A line is one row of the invoice as it was issued: a description and a signed amount (a credit or a
-- refund is negative), in the order of its position. counts_toward_subtotal says whether the amount is a
-- part of the subtotal (the platform share, a fee, a credit, a refund) or only shows where it comes from
-- (the gross revenue, the partner share); the screen explains the total from the first kind. The subtotal,
-- the VAT and the total stay on the invoice, as the database stored them: nothing is calculated again.
--
-- Nothing in the app writes lines yet (the story that generates an invoice will, through its own
-- function): there is no insert, update or delete policy, so no app role can change a line. A trigger,
-- as for the other finance rows, refuses a delete by anon and authenticated if a policy for it is ever
-- added. A partner user reads the lines of the invoices of its own partner; an admin and an operations
-- manager read all. The invoice policy decides which invoices exist for a role; this one follows it.
--
-- Rollback: drop trigger prevent_finance_delete on public.invoice_lines;
--   drop table public.invoice_lines; drop function public.invoice_partner_id(uuid);

create function public.invoice_partner_id(p_invoice_id uuid)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select partner_id
  from public.invoices
  where id = p_invoice_id;
$$;

revoke execute on function public.invoice_partner_id(uuid) from public;
revoke execute on function public.invoice_partner_id(uuid) from anon;
grant execute on function public.invoice_partner_id(uuid) to authenticated;

comment on function public.invoice_partner_id(uuid) is
  'Returns the partner_id that owns the given invoice, bypassing invoices RLS via SECURITY DEFINER, so the policy of invoice_lines does not re-enter the policy of invoices (VI-F09-S03).';

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  position integer not null,
  description text not null,
  amount numeric(12,2) not null,
  counts_toward_subtotal boolean not null default true,
  created_at timestamptz not null default now(),
  constraint invoice_lines_position_check check (position >= 1),
  constraint invoice_lines_description_check
    check (btrim(description) <> '' and char_length(description) <= 200),
  constraint invoice_lines_invoice_position_unique unique (invoice_id, position)
);

alter table public.invoice_lines enable row level security;

create policy "invoice_lines_select_admin_ops_manager"
  on public.invoice_lines for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "invoice_lines_select_partner_user"
  on public.invoice_lines for select
  to authenticated
  using (public.invoice_partner_id(invoice_id) = (select public.current_user_partner_id()));

create trigger prevent_finance_delete
  before delete on public.invoice_lines
  for each row
  execute function public.prevent_finance_row_delete();
