-- CO-F07-S08, S09, S10: a webhook call creates a pending booking (R11), a call without a valid signature
-- creates nothing (R12), a repeated external booking number returns the first booking (R13), and calls
-- are limited (E6). The source "webhook" is recorded in the booking history (R14); a booking is created
-- only for the partner of the webhook configuration (R15).
--
-- * booking_webhook_config: one row per partner. It holds the shared secret and the airport of the bookings.
--   No client role can read it; only the service role (the webhook route) does, through get_booking_webhook_secret().
-- * booking_webhook_calls: the call log. Append only for every role; an admin or an operations manager reads it.
-- * receive_webhook_booking(), log_booking_webhook_call(), get_booking_webhook_secret(): service role only.
--
-- Rollback:
--   drop function if exists public.receive_webhook_booking(uuid, jsonb);
--   drop function if exists public.log_booking_webhook_call(uuid, text, text, text);
--   drop function if exists public.get_booking_webhook_secret(uuid);
--   drop table public.booking_webhook_calls;
--   drop function if exists public.refuse_booking_webhook_call_change();
--   drop table public.booking_webhook_config;

create table public.booking_webhook_config (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references public.partners(id) on delete restrict,
  airport_id uuid not null references public.airports(id) on delete restrict,
  secret text not null check (char_length(secret) >= 32),
  created_at timestamptz not null default now()
);

create index booking_webhook_config_airport_id_idx on public.booking_webhook_config (airport_id);

-- RLS on and no policy: a signed-in user sees nothing. The privileges are revoked as well (a second wall).
alter table public.booking_webhook_config enable row level security;
revoke all on public.booking_webhook_config from anon, authenticated;

create table public.booking_webhook_calls (
  id uuid primary key default gen_random_uuid(),
  config_id uuid references public.booking_webhook_config(id) on delete restrict,
  partner_id uuid references public.partners(id) on delete restrict,
  received_at timestamptz not null default now(),
  result text not null check (result in ('created', 'duplicate', 'rejected', 'invalid_signature', 'invalid_body', 'rate_limited')),
  external_booking_number text check (char_length(external_booking_number) <= 100),
  booking_id uuid references public.bookings(id) on delete restrict,
  error text check (char_length(error) <= 500)
);

create index booking_webhook_calls_config_received_idx on public.booking_webhook_calls (config_id, received_at desc);
create index booking_webhook_calls_partner_id_idx on public.booking_webhook_calls (partner_id);
create index booking_webhook_calls_booking_id_idx on public.booking_webhook_calls (booking_id);

alter table public.booking_webhook_calls enable row level security;

create policy "booking_webhook_calls_select_admin_ops_manager"
  on public.booking_webhook_calls
  for select
  to authenticated
  using (coalesce(public.is_admin_or_ops_manager(), false));

revoke insert, update, delete, truncate on public.booking_webhook_calls from anon, authenticated;

-- The history is never changed or deleted, the service role and the owner included.
create function public.refuse_booking_webhook_call_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The webhook call log is append only' using errcode = '55000';
end;
$$;

create trigger booking_webhook_calls_no_change
  before update or delete on public.booking_webhook_calls
  for each row execute function public.refuse_booking_webhook_call_change();

create trigger booking_webhook_calls_no_truncate
  before truncate on public.booking_webhook_calls
  for each statement execute function public.refuse_booking_webhook_call_change();

-- -----------------------------------------------------------------------------
-- get_booking_webhook_secret(): the secret of one configuration, NULL when it does not exist.
-- -----------------------------------------------------------------------------
create function public.get_booking_webhook_secret(p_config_id uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select c.secret from public.booking_webhook_config c where c.id = p_config_id;
$$;

-- -----------------------------------------------------------------------------
-- log_booking_webhook_call(): the log of a call that never reached receive_webhook_booking()
-- (wrong signature, body not valid). An unknown configuration is logged without a partner.
-- -----------------------------------------------------------------------------
create function public.log_booking_webhook_call(
  p_config_id uuid,
  p_result text,
  p_external_booking_number text,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.booking_webhook_calls (config_id, partner_id, result, external_booking_number, error)
  select c.id, c.partner_id, p_result, left(nullif(btrim(p_external_booking_number), ''), 100), left(p_error, 500)
    from (select p_config_id as id) as req
    left join public.booking_webhook_config c on c.id = req.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- receive_webhook_booking(): p_body is the JSON of the call, already checked by the route
-- (external_booking_number, seat_category_id, pickup_at, return_at, daily_rate and the optional
-- child_age_band, vehicle, notes). Answers {status: 'created' | 'duplicate', booking_id},
-- {status: 'rejected', message} or {status: 'rate_limited'}; every answer is logged.
-- -----------------------------------------------------------------------------
create function public.receive_webhook_booking(p_config_id uuid, p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_limit_per_minute constant integer := 60;
  v_config public.booking_webhook_config;
  v_external text;
  v_existing uuid;
  v_booking public.bookings;
  v_recent integer;
  v_message text;
begin
  select * into v_config from public.booking_webhook_config where id = p_config_id;

  if not found then
    raise exception 'Webhook is not configured' using errcode = '22023';
  end if;

  v_external := nullif(btrim(p_body->>'external_booking_number'), '');

  -- The same lock as a CSV import of the partner, so the two never create the same booking at once (R13).
  perform pg_advisory_xact_lock(hashtextextended('booking_import:' || v_config.partner_id::text, 0));

  select count(*) into v_recent
    from public.booking_webhook_calls l
   where l.config_id = v_config.id
     and l.received_at > now() - interval '1 minute'
     and l.result in ('created', 'duplicate', 'rejected');

  if v_recent >= c_limit_per_minute then
    insert into public.booking_webhook_calls (config_id, partner_id, result, external_booking_number, error)
    values (v_config.id, v_config.partner_id, 'rate_limited', left(v_external, 100), 'Too many calls');

    return jsonb_build_object('status', 'rate_limited');
  end if;

  if v_external is not null then
    select b.id into v_existing
      from public.bookings b
     where b.partner_id = v_config.partner_id and b.external_booking_number = v_external
     order by b.created_at asc
     limit 1;

    if v_existing is not null then
      insert into public.booking_webhook_calls (config_id, partner_id, result, external_booking_number, booking_id)
      values (v_config.id, v_config.partner_id, 'duplicate', left(v_external, 100), v_existing);

      return jsonb_build_object('status', 'duplicate', 'booking_id', v_existing);
    end if;
  end if;

  begin
    if (p_body->>'return_at')::timestamptz < (p_body->>'pickup_at')::timestamptz then
      raise exception 'Return time cannot be before pickup time' using errcode = '22023';
    end if;

    if (p_body->>'daily_rate')::numeric < 0 then
      raise exception 'Daily rate must be zero or more' using errcode = '22023';
    end if;

    if not exists (select 1 from public.partners p where p.id = v_config.partner_id and p.status = 'active') then
      raise exception 'Partner must exist and be active' using errcode = '22023';
    end if;

    if not exists (
      select 1 from public.seat_categories sc where sc.id = (p_body->>'seat_category_id')::uuid and sc.is_active
    ) then
      raise exception 'Seat category must exist and be active' using errcode = '22023';
    end if;

    perform set_config('app.booking_change', 'on', true);
    perform set_config('app.booking_source', 'webhook', true);

    insert into public.bookings (
      booking_number, partner_id, airport_id, seat_category_id,
      pickup_at, return_at, daily_rate,
      external_booking_number, child_age_band, vehicle, notes, status
    )
    values (
      public.generate_booking_number(), v_config.partner_id, v_config.airport_id, (p_body->>'seat_category_id')::uuid,
      (p_body->>'pickup_at')::timestamptz, (p_body->>'return_at')::timestamptz, (p_body->>'daily_rate')::numeric,
      v_external, nullif(btrim(p_body->>'child_age_band'), ''), nullif(btrim(p_body->>'vehicle'), ''),
      nullif(btrim(p_body->>'notes'), ''), 'pending'
    )
    returning * into v_booking;
  exception when others then
    -- Only the messages raised above are shown; no other database text leaves the function.
    v_message := case when sqlstate = '22023' then sqlerrm else 'The booking could not be created.' end;

    insert into public.booking_webhook_calls (config_id, partner_id, result, external_booking_number, error)
    values (v_config.id, v_config.partner_id, 'rejected', left(v_external, 100), left(v_message, 500));

    return jsonb_build_object('status', 'rejected', 'message', v_message);
  end;

  perform set_config('app.booking_change', '', true);
  perform set_config('app.booking_source', '', true);

  insert into public.booking_webhook_calls (config_id, partner_id, result, external_booking_number, booking_id)
  values (v_config.id, v_config.partner_id, 'created', left(v_external, 100), v_booking.id);

  return jsonb_build_object('status', 'created', 'booking_id', v_booking.id);
end;
$$;

-- Only the service role may call the three functions: no signed-in user and no anonymous caller.
revoke execute on function public.get_booking_webhook_secret(uuid) from public, anon, authenticated;
revoke execute on function public.log_booking_webhook_call(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.receive_webhook_booking(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.get_booking_webhook_secret(uuid) to service_role;
grant execute on function public.log_booking_webhook_call(uuid, text, text, text) to service_role;
grant execute on function public.receive_webhook_booking(uuid, jsonb) to service_role;
