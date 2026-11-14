-- Settlements list (new design): each settlement gets a readable number, SET-<year>-<4 digits>, for
-- example SET-2026-0010. The year is the year of the period the settlement covers; the sequence
-- counts the settlements of that year, in the order they were created.
--
-- Existing settlements are numbered once, here. A new settlement gets its number from a BEFORE
-- INSERT trigger, so generate_monthly_settlement() does not change. The trigger takes a transaction
-- lock for the year, so two settlements saved at the same time cannot get the same number; the unique
-- constraint is the last guard. RLS on settlements is not touched: the column is read with the same
-- policies as the rest of the row.
--
-- Rollback:
--   drop trigger if exists set_settlements_number on public.settlements;
--   drop function if exists public.assign_settlement_number();
--   alter table public.settlements drop column settlement_number;

alter table public.settlements add column settlement_number text;

update public.settlements s
   set settlement_number = 'SET-' || n.year || '-' || lpad(n.seq::text, 4, '0')
  from (
    select id,
           to_char(period_start, 'YYYY') as year,
           row_number() over (
             partition by to_char(period_start, 'YYYY')
             order by created_at, id
           ) as seq
      from public.settlements
  ) n
 where s.id = n.id;

alter table public.settlements
  alter column settlement_number set not null,
  add constraint settlements_settlement_number_unique unique (settlement_number),
  add constraint settlements_settlement_number_format
    check (settlement_number ~ '^SET-[0-9]{4}-[0-9]{4,}$');

create function public.assign_settlement_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year text := to_char(new.period_start, 'YYYY');
  v_next integer;
begin
  perform pg_advisory_xact_lock(hashtext('settlement_number_' || v_year));

  select coalesce(max(substring(s.settlement_number from 10)::integer), 0) + 1
    into v_next
    from public.settlements s
   where s.settlement_number like 'SET-' || v_year || '-%';

  new.settlement_number := 'SET-' || v_year || '-' || lpad(v_next::text, 4, '0');

  return new;
end;
$$;

revoke execute on function public.assign_settlement_number() from public;
revoke execute on function public.assign_settlement_number() from anon;
revoke execute on function public.assign_settlement_number() from authenticated;

create trigger set_settlements_number
  before insert on public.settlements
  for each row
  execute function public.assign_settlement_number();
