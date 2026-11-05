-- VI-F02-S12: run the flight simulator (spec VI-F02 S3, R4, R11, R13).
--
-- An admin creates a test flight change (an early or a delayed flight) from the Flight simulator screen. The change is
-- stored like a provider update: the flight takes the new values and the sync time, and the history gets one row with
-- the source `system` (the history names sandbox data and the simulator `system`).
--
-- apply_flight_refresh() does that write, but it is for the system only: its EXECUTE is granted to service_role, and
-- the one service-role client of the app is kept for the scheduled refresh (docs/security.md). A signed-in admin
-- therefore gets its own door:
--
-- apply_simulated_flight_change() checks that the caller is an active admin, then hands the write to
-- apply_flight_refresh() with the source fixed to `system`. No other role can call it through: the check is inside the
-- function, not only in the app, and EXECUTE is revoked from public and anon. It adds no table and changes no policy:
-- flights and flight_updates keep their RLS and the append-only trigger.
--
-- p_expected_synced_at is the sync time the caller read, as in the refresh: when the flight was refreshed in between,
-- nothing is written and the function returns false.
--
-- Error codes: 42501  the caller is not an admin.   22023  a value is missing or not allowed (from the refresh).
--              P0002  the flight does not exist (from the refresh).
--
-- Rollback:
--   drop function public.apply_simulated_flight_change(uuid, jsonb, jsonb, timestamptz);

create function public.apply_simulated_flight_change(
  p_flight_id uuid,
  p_values jsonb,
  p_changes jsonb,
  p_expected_synced_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Only an admin may apply a simulated flight change' using errcode = '42501';
  end if;

  return public.apply_flight_refresh(p_flight_id, p_values, p_changes, 'system', p_expected_synced_at);
end;
$$;

revoke execute on function public.apply_simulated_flight_change(uuid, jsonb, jsonb, timestamptz) from public;
revoke execute on function public.apply_simulated_flight_change(uuid, jsonb, jsonb, timestamptz) from anon;
grant execute on function public.apply_simulated_flight_change(uuid, jsonb, jsonb, timestamptz) to authenticated;

comment on function public.apply_simulated_flight_change(uuid, jsonb, jsonb, timestamptz) is
  'Admin only. Stores a simulated flight change like a provider update (source system) through apply_flight_refresh().';
