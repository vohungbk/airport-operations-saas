-- F04: redefine user_role enum to the RBAC ticket's 4 roles.
-- Postgres cannot drop/rename enum values in place, so this creates a new
-- type, migrates public.users.role via an explicit mapping, drops the old
-- type, and renames the new type into user_role's place. No RLS statements
-- belong here — public.users stays in its documented no-RLS exception
-- (see docs/database.md) until F05.
--
-- Mapping (semantic, not a rename):
--   operator_admin -> admin
--   partner_admin  -> partner_user
--   partner_staff  -> partner_user
--   technician     -> technician (unchanged)
--   operations_manager is new, no predecessor.

create type user_role_new as enum (
  'admin',
  'operations_manager',
  'technician',
  'partner_user'
);

alter table public.users
  alter column role type user_role_new
  using (
    case role::text
      when 'operator_admin' then 'admin'
      when 'partner_admin' then 'partner_user'
      when 'partner_staff' then 'partner_user'
      when 'technician' then 'technician'
    end
  )::user_role_new;

drop type user_role;

alter type user_role_new rename to user_role;

-- Rollback (run manually against the target database if needed):
-- Note: operations_manager has no predecessor value, so any row that was
-- set to operations_manager after this migration shipped has no safe
-- target in the old 4-value enum. The mapping below maps it to null,
-- which will fail the column's `not null` constraint — reassign those
-- rows to a concrete old-enum role by hand before running this rollback.
-- create type user_role_old as enum (
--   'operator_admin',
--   'partner_admin',
--   'partner_staff',
--   'technician'
-- );
--
-- alter table public.users
--   alter column role type user_role_old
--   using (
--     case role::text
--       when 'admin' then 'operator_admin'
--       when 'partner_user' then 'partner_staff'
--       when 'technician' then 'technician'
--       when 'operations_manager' then null
--     end
--   )::user_role_old;
--
-- drop type user_role;
-- alter type user_role_old rename to user_role;
