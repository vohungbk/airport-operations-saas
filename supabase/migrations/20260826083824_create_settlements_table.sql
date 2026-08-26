-- F02: settlements table. RLS deferred to F05.

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  gross_revenue numeric(12,2) not null default 0,
  partner_share numeric(12,2) not null default 0,
  platform_share numeric(12,2) not null default 0,
  refunds numeric(12,2) not null default 0,
  adjustments numeric(12,2) not null default 0,
  launch_credit numeric(12,2) not null default 0,
  final_amount numeric(12,2) not null default 0,
  status settlement_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlements_period_check check (period_end >= period_start)
);

create index settlements_partner_id_idx on public.settlements(partner_id);

create trigger set_settlements_updated_at
  before update on public.settlements
  for each row
  execute function set_updated_at();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists set_settlements_updated_at on public.settlements;
-- drop index if exists settlements_partner_id_idx;
-- drop table if exists public.settlements;
