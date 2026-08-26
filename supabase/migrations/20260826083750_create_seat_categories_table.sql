-- F02: seat_categories table. RLS deferred to F05.
-- min_child_age/max_child_age are in months (plan.md open question 3).

create table public.seat_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  min_child_age integer not null,
  max_child_age integer not null,
  safety_standard text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seat_categories_age_range_check check (max_child_age >= min_child_age)
);

create trigger set_seat_categories_updated_at
  before update on public.seat_categories
  for each row
  execute function set_updated_at();

-- Rollback (run manually against the target database if needed):
-- drop trigger if exists set_seat_categories_updated_at on public.seat_categories;
-- drop table if exists public.seat_categories;
