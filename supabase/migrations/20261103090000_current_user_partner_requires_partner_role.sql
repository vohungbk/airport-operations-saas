-- VI-F03-S08: partner data goes only to a user who is a partner user.
--
-- current_user_partner_id() is the scope of every partner policy. It returned
-- the partner on the profile of any active user whose partner is active. The
-- partner id is null for admin, operations manager and technician by design
-- (docs/database.md), but nothing in the function said so: if an administrator
-- changed a partner user to another role and left the partner on the profile,
-- the partner policies would still give that user the partner's rows through the
-- API. A permission revoked by changing the role now takes effect in the
-- database at the next request, not only in the screens.
--
-- Same signature, SECURITY DEFINER, empty search_path. It only narrows: nothing
-- that returned NULL returns a partner now.

create or replace function public.current_user_partner_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select u.partner_id
  from public.users u
  join public.partners p on p.id = u.partner_id
  where u.id = auth.uid()
    and u.is_active = true
    and u.role = 'partner_user'
    and p.status = 'active'
  limit 1;
$$;

comment on function public.current_user_partner_id() is
  'Returns the partner of the caller from public.users, or null when there is no session, the profile row is missing, the account is inactive, the caller is not a partner user, the caller has no partner, or the partner is not active (VI-F03-S07, VI-F03-S08). SECURITY DEFINER so it can read public.users and public.partners from inside policies without RLS recursion.';

-- Rollback (run manually against the target database if needed):
-- create or replace function public.current_user_partner_id()
-- returns uuid language sql security definer stable set search_path = ''
-- as $$ select u.partner_id from public.users u join public.partners p on p.id = u.partner_id
--       where u.id = auth.uid() and u.is_active = true and p.status = 'active' limit 1; $$;
