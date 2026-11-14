-- Commercial terms (new design): the Terms history table shows who changed the terms ("Changed by").
--
-- A version of the terms gets the user who saved it. A BEFORE INSERT trigger fills changed_by from
-- the caller (auth.uid()), so set_partner_commercial_terms() does not change: it is SECURITY DEFINER
-- but auth.uid() still reads the claims of the caller. Versions saved before this migration have no
-- user (null) and are shown with a dash. If the user is deleted the column is cleared, as the
-- status_changed_by of settlements is. The guard on updates is not touched: it lists the terms
-- columns by name and changed_by is not one of them. RLS is not touched: the column is read with the
-- policies of the row (admin and operations manager read every partner, a partner user its own).
--
-- Rollback:
--   drop trigger if exists set_partner_commercial_terms_changed_by on public.partner_commercial_terms;
--   drop function if exists public.set_partner_commercial_terms_changed_by();
--   alter table public.partner_commercial_terms drop column changed_by;

alter table public.partner_commercial_terms
  add column changed_by uuid references public.users(id) on delete set null;

create function public.set_partner_commercial_terms_changed_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.changed_by := coalesce(new.changed_by, auth.uid());

  return new;
end;
$$;

revoke execute on function public.set_partner_commercial_terms_changed_by() from public;
revoke execute on function public.set_partner_commercial_terms_changed_by() from anon;
revoke execute on function public.set_partner_commercial_terms_changed_by() from authenticated;

create trigger set_partner_commercial_terms_changed_by
  before insert on public.partner_commercial_terms
  for each row
  execute function public.set_partner_commercial_terms_changed_by();

create index partner_commercial_terms_changed_by_idx
  on public.partner_commercial_terms (changed_by);
