-- VI-F03-S07: a partner user of a partner that is not active has no partner
-- data.
--
-- current_user_partner_id() is the scope of every partner policy (bookings,
-- seats, incidents, jobs, finance, and the partners row itself). It returned
-- the partner of any active user, so the users of a partner that was
-- deactivated (status suspended, inactive or pending) could still read the
-- partner's data through the API. It now returns the partner only when the
-- partner is active, so all of those policies give such a user no rows, and
-- the change holds for the next request of a user who is signed in.
--
-- Same signature, SECURITY DEFINER, empty search_path. It only narrows: an
-- inactive user, a user with no partner, and a partner that is not active all
-- give NULL, and nothing gains access. Admin, operations manager and
-- technician do not use this function for their access.

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
    and p.status = 'active'
  limit 1;
$$;

comment on function public.current_user_partner_id() is
  'Returns the partner of the caller from public.users, or null when there is no session, the profile row is missing, the account is inactive, the caller has no partner, or the partner is not active (VI-F03-S07). SECURITY DEFINER so it can read public.users and public.partners from inside policies without RLS recursion.';

-- Rollback (run manually against the target database if needed):
-- create or replace function public.current_user_partner_id()
-- returns uuid language sql security definer stable set search_path = ''
-- as $$ select partner_id from public.users where id = auth.uid() and is_active = true limit 1; $$;
