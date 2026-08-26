-- F02: partner_commercial_terms table. RLS deferred to F05.
-- launch_mode type is a guessed boolean (plan.md open question 5).

create table public.partner_commercial_terms (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  partner_share_percent numeric(5,2) not null,
  platform_share_percent numeric(5,2) not null,
  launch_mode boolean not null default false,
  launch_credit_target numeric(12,2),
  launch_credit_accumulated numeric(12,2) default 0,
  annual_fee numeric(12,2),
  onboarding_fee numeric(12,2),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_commercial_terms_partner_share_check
    check (partner_share_percent >= 0 and partner_share_percent <= 100),
  constraint partner_commercial_terms_platform_share_check
    check (platform_share_percent >= 0 and platform_share_percent <= 100)
);

create trigger set_partner_commercial_terms_updated_at
  before update on public.partner_commercial_terms
  for each row
  execute function set_updated_at();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists set_partner_commercial_terms_updated_at on public.partner_commercial_terms;
-- drop table if exists public.partner_commercial_terms;
