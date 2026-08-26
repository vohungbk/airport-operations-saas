-- F02: invoices table. RLS deferred to F05.

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  settlement_id uuid references public.settlements(id) on delete restrict,
  invoice_number text not null unique,
  issue_date date not null,
  due_date date not null,
  subtotal numeric(12,2) not null,
  vat numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  status invoice_status not null default 'draft',
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_partner_id_idx on public.invoices(partner_id);
create index invoices_status_idx on public.invoices(status);

create trigger set_invoices_updated_at
  before update on public.invoices
  for each row
  execute function set_updated_at();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists set_invoices_updated_at on public.invoices;
-- drop index if exists invoices_status_idx;
-- drop index if exists invoices_partner_id_idx;
-- drop table if exists public.invoices;
