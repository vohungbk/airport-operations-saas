-- VI-F02-S11: handle provider errors (spec VI-F02 R12, E3).
--
-- When the flight source fails, times out or is rate limited, the refresh job writes nothing to the flights (the last
-- good data and its sync time stay, so the data ages and is shown as stale) and keeps why it failed. This table holds
-- the last error of each source, for the provider settings page. One row per source; a new error replaces the old one.
-- Only the kind is kept, never the message of the source, so nothing about the provider's address or key can be stored.
--
-- Read access: admin only, the same people who open the provider settings page. There is no insert, update or delete
-- policy: the only writer is record_flight_provider_error(), which is for the system (the service role) and never an
-- endpoint a person can call. It does not touch flights, bookings or any other table.
--
-- Error codes: 22023  the source or the kind is missing or not allowed.
--
-- Rollback:
--   drop function public.record_flight_provider_error(text, text);
--   drop table public.flight_provider_status;

create table public.flight_provider_status (
  source text primary key check (source in ('provider', 'sandbox', 'simulator')),
  last_error_kind text not null check (last_error_kind in ('timeout', 'rate_limited', 'unavailable', 'invalid_response')),
  last_error_at timestamptz not null default now()
);

alter table public.flight_provider_status enable row level security;

create policy "flight_provider_status_select_admin"
  on public.flight_provider_status for select
  to authenticated
  using ((select public.current_user_role()) = 'admin');

create function public.record_flight_provider_error(p_source text, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_source is null or p_source not in ('provider', 'sandbox', 'simulator') then
    raise exception 'The source is not allowed' using errcode = '22023';
  end if;

  if p_kind is null or p_kind not in ('timeout', 'rate_limited', 'unavailable', 'invalid_response') then
    raise exception 'The error kind is not allowed' using errcode = '22023';
  end if;

  insert into public.flight_provider_status (source, last_error_kind, last_error_at)
  values (p_source, p_kind, now())
  on conflict (source) do update
    set last_error_kind = excluded.last_error_kind,
        last_error_at = excluded.last_error_at;
end;
$$;

revoke execute on function public.record_flight_provider_error(text, text) from public;
revoke execute on function public.record_flight_provider_error(text, text) from anon;
revoke execute on function public.record_flight_provider_error(text, text) from authenticated;
grant execute on function public.record_flight_provider_error(text, text) to service_role;
