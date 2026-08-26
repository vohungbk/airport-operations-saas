-- F02: partners table. RLS deferred to F05 — see docs/database.md.

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  contact_email text not null,
  status partner_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_partners_updated_at
  before update on public.partners
  for each row
  execute function set_updated_at();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists set_partners_updated_at on public.partners;
-- drop table if exists public.partners;
