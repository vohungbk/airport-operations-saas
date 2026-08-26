-- F02: users table. RLS deferred to F05.
-- partner_id is nullable: operator_admin users are not tied to a partner.

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  role user_role not null,
  partner_id uuid references public.partners(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_partner_id_idx on public.users(partner_id);
create index users_role_idx on public.users(role);

create trigger set_users_updated_at
  before update on public.users
  for each row
  execute function set_updated_at();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists set_users_updated_at on public.users;
-- drop index if exists users_role_idx;
-- drop index if exists users_partner_id_idx;
-- drop table if exists public.users;
