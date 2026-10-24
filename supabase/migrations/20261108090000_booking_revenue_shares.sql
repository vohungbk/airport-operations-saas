-- VI-F04-S05: the partner and platform shares of a completed rental (spec VI-F04 R11, R17, A1).
--
-- When a booking becomes completed, the trigger of VI-F04-S04 already writes rental_days,
-- paid_days, gross_revenue and revenue_flag. It now writes the two shares and the terms it used:
--   * the terms are the version in force on the day the rental completes (the date of the
--     database server, UTC), for the partner of the booking (E5); the booking keeps the id of
--     that version in commercial_terms_id, so every figure can be explained;
--   * partner_share = round(gross x partner_share_percent / 100, 2), platform_share = gross -
--     partner_share, so the two always add up to the gross revenue, to the cent;
--   * a completed booking that is calculated again (its period or rate changed) uses the terms it
--     kept, not the terms in force now: completed rentals keep the terms they were calculated with;
--   * a rental with no duration has no gross and no shares (revenue_flag = invalid_duration);
--   * a partner with no terms in force gets the gross but no shares, and revenue_flag = no_terms.
--     The default of 30 and 70 is not used: shares come from agreed terms.
--
-- Only the standard partner share is used. The launch share and the launch credit (VI-F04-S06,
-- spec R12, R13) are not applied here.
--
-- Rounding (spec Q1 is open, assumption): the partner share is rounded to the cent, half away
-- from zero (the PostgreSQL default); the platform share is the rest.
--
-- Money is numeric(12,2), never a float. The table now refuses a negative gross revenue or
-- share, one share without the other, and shares that do not add up to the gross revenue.
--
-- The trigger function is SECURITY DEFINER with an empty search_path: whoever completes a rental
-- may not be able to read the terms. It takes nothing but the booking row, and nobody can run it
-- directly. A booking completed before this migration is not calculated again.
--
-- Rollback: put the bodies of apply_booking_revenue_on_completion() and guard_booking_update()
--   back from 20261107090000_booking_paid_days_cap.sql, then
--   drop function public.booking_shares(numeric, numeric);
--   alter table public.bookings drop constraint bookings_gross_revenue_check,
--     drop constraint bookings_partner_share_check, drop constraint bookings_platform_share_check,
--     drop constraint bookings_shares_together_check, drop constraint bookings_shares_sum_check,
--     drop constraint bookings_revenue_flag_check,
--     add constraint bookings_revenue_flag_check check (revenue_flag is null or revenue_flag = 'invalid_duration'),
--     drop column commercial_terms_id;

alter table public.bookings
  add column commercial_terms_id uuid references public.partner_commercial_terms(id) on delete restrict;

alter table public.bookings
  drop constraint bookings_revenue_flag_check,
  add constraint bookings_revenue_flag_check
    check (revenue_flag is null or revenue_flag in ('invalid_duration', 'no_terms')),
  add constraint bookings_gross_revenue_check
    check (gross_revenue is null or gross_revenue >= 0),
  add constraint bookings_partner_share_check
    check (partner_share is null or partner_share >= 0),
  add constraint bookings_platform_share_check
    check (platform_share is null or platform_share >= 0),
  add constraint bookings_shares_together_check
    check ((partner_share is null) = (platform_share is null)),
  add constraint bookings_shares_sum_check
    check (
      partner_share is null
      or (gross_revenue is not null and partner_share + platform_share = gross_revenue)
    );

-- -----------------------------------------------------------------------------
-- The split of a gross revenue, in one place. The platform share is the rest, so the two
-- add up to the gross revenue whatever the percentage.
-- -----------------------------------------------------------------------------
create function public.booking_shares(
  p_gross_revenue numeric,
  p_partner_share_percent numeric
)
returns table (partner_share numeric, platform_share numeric)
language sql
immutable
set search_path = ''
as $$
  select
    round(p_gross_revenue * p_partner_share_percent / 100, 2),
    p_gross_revenue - round(p_gross_revenue * p_partner_share_percent / 100, 2);
$$;

revoke execute on function public.booking_shares(numeric, numeric) from public;
revoke execute on function public.booking_shares(numeric, numeric) from anon;
grant execute on function public.booking_shares(numeric, numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- The trigger of VI-F04-S04, now with the shares and the terms.
-- -----------------------------------------------------------------------------
create or replace function public.apply_booking_revenue_on_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule record;
  v_terms public.partner_commercial_terms;
  v_shares record;
begin
  select * into v_rule
    from public.booking_revenue_terms(new.pickup_at, new.return_at, new.daily_rate);

  new.rental_days := v_rule.rental_days;
  new.paid_days := v_rule.paid_days;
  new.gross_revenue := v_rule.gross_revenue;
  new.revenue_flag := v_rule.revenue_flag;
  new.partner_share := null;
  new.platform_share := null;

  if v_rule.revenue_flag is not null then
    return new;
  end if;

  if old.status = 'completed' and old.commercial_terms_id is not null then
    -- Calculated again: the terms the rental was calculated with, not the terms of today.
    select * into v_terms
      from public.partner_commercial_terms t
     where t.id = old.commercial_terms_id;
  else
    select * into v_terms
      from public.partner_commercial_terms t
     where t.partner_id = new.partner_id
       and t.effective_from <= current_date
       and (t.effective_to is null or t.effective_to >= current_date)
     order by t.effective_from desc
     limit 1;
  end if;

  if not found then
    new.revenue_flag := 'no_terms';
    return new;
  end if;

  select * into v_shares
    from public.booking_shares(new.gross_revenue, v_terms.partner_share_percent);

  new.partner_share := v_shares.partner_share;
  new.platform_share := v_shares.platform_share;
  new.commercial_terms_id := v_terms.id;

  return new;
end;
$$;

revoke execute on function public.apply_booking_revenue_on_completion() from public;
revoke execute on function public.apply_booking_revenue_on_completion() from anon;

-- -----------------------------------------------------------------------------
-- commercial_terms_id joins the finance fields that only the booking functions can change.
-- -----------------------------------------------------------------------------
create or replace function public.guard_booking_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_in_rpc boolean :=
    coalesce(nullif(btrim(current_setting('app.booking_change', true)), ''), 'off') = 'on';
begin
  if v_in_rpc then
    return new;
  end if;

  if pg_trigger_depth() > 1
     and old.assigned_seat_id is not null
     and new.assigned_seat_id is null
     and (to_jsonb(new) - 'assigned_seat_id' - 'updated_at')
         = (to_jsonb(old) - 'assigned_seat_id' - 'updated_at') then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.assigned_seat_id is distinct from old.assigned_seat_id
     or new.partner_id is distinct from old.partner_id
     or new.booking_number is distinct from old.booking_number
     or new.airport_id is distinct from old.airport_id
     or new.seat_category_id is distinct from old.seat_category_id
     or new.pickup_at is distinct from old.pickup_at
     or new.return_at is distinct from old.return_at
     or new.daily_rate is distinct from old.daily_rate
     or new.paid_days is distinct from old.paid_days
     or new.rental_days is distinct from old.rental_days
     or new.revenue_flag is distinct from old.revenue_flag
     or new.commercial_terms_id is distinct from old.commercial_terms_id
     or new.gross_revenue is distinct from old.gross_revenue
     or new.partner_share is distinct from old.partner_share
     or new.platform_share is distinct from old.platform_share
  then
    raise exception 'Booking status, seat, schedule, ownership and finance fields can only be changed through the booking functions'
      using errcode = '55000';
  end if;

  return new;
end;
$$;
