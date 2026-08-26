-- F02: ai_queries table (analytics/log, not operational or financial).
-- RLS deferred to F05. Both FKs use SET NULL per plan.md's deliberate
-- exception to the RESTRICT-for-ownership rule.

create table public.ai_queries (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  question text not null,
  intent text,
  query_result jsonb,
  answer text,
  created_at timestamptz not null default now()
);

-- Rollback (run manually against the target database if needed):
-- drop table if exists public.ai_queries;
