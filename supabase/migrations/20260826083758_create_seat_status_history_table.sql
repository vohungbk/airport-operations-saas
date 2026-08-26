-- F02: seat_status_history table (immutable audit log). RLS deferred to F05.
-- Column list is proposed per plan.md open question 2 (absent from the
-- ticket's required-fields section).

create table public.seat_status_history (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid not null references public.seats(id) on delete restrict,
  from_status seat_status,
  to_status seat_status not null,
  changed_by uuid references public.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index seat_status_history_seat_id_idx on public.seat_status_history(seat_id);

-- Rollback (run manually against the target database if needed):
-- drop index if exists seat_status_history_seat_id_idx;
-- drop table if exists public.seat_status_history;
