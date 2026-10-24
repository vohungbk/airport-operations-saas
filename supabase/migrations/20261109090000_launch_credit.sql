-- VI-F04-S06: the extra launch share accumulates toward the launch credit target (spec VI-F04
-- R12, R13, E3, E4).
--
-- Launch terms are active for a partner while its terms have a launch credit target and the
-- balance has not reached it. There is no switch: setting a target (VI-F04-S02) turns launch on,
-- reaching it turns it off.
--
-- When a rental is completed and launch terms are active, the partner gets the launch share
-- instead of the standard share. The extra, the launch share of the gross revenue minus the
-- standard share of it (both rounded to the cent), is the launch credit of that rental. It is
-- kept on the booking: launch_credit (the extra of this rental) and launch_credit_balance (the
-- balance of the partner after this rental; null when launch did not apply). The balance of a
-- partner is the sum of the launch credit of its completed bookings; that sum is the truth.
-- launch_credit_accumulated and launch_mode of the terms version in use are a copy for display,
-- refreshed after every completion.
--
-- When the balance has reached the target, every later rental uses the standard share (R13).
-- A rental that crosses the target (E3, spec Q6 is open, assumption): it follows the terms at its
-- completion, so the whole rental gets the launch share, the balance may end above the target,
-- and both are recorded on the booking.
--
-- Completions of one partner are calculated one after the other (E4): the trigger locks the
-- partner row before it reads the balance, so two rentals completed at the same time do not
-- count the same credit twice.
--
-- A completed booking that is calculated again (its period or rate changed) is replayed at its
-- own place: the balance before it is the balance after it minus its credit. Launch applies to it
-- only if it applied the first time. The bookings completed after it are not calculated again.
-- A refund or a chargeback is not handled here (spec Q4 is open).
--
-- set_partner_commercial_terms() sets launch_mode on the new version: a target the balance has not
-- reached. The rest of the function is as in 20261106090000.
--
-- Rollback: put the bodies of apply_booking_revenue_on_completion() and guard_booking_update()
--   back from 20261108090000_booking_revenue_shares.sql and the launch_mode line of
--   set_partner_commercial_terms() back from 20261106090000, then
--   alter table public.bookings drop constraint bookings_launch_credit_check,
--     drop constraint bookings_launch_credit_balance_check, drop constraint bookings_launch_credit_together_check,
--     drop column launch_credit, drop column launch_credit_balance.

alter table public.bookings
  add column launch_credit numeric(12,2) not null default 0,
  add column launch_credit_balance numeric(12,2),
  add constraint bookings_launch_credit_check check (launch_credit >= 0),
  add constraint bookings_launch_credit_balance_check
    check (launch_credit_balance is null or launch_credit_balance >= 0),
  add constraint bookings_launch_credit_together_check
    check (launch_credit_balance is not null or launch_credit = 0);

-- -----------------------------------------------------------------------------
-- The trigger of VI-F04-S04 and S05, now with the launch credit.
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
  v_standard numeric;
  v_partner numeric;
  v_before numeric;
  v_others numeric;
  v_launch boolean := false;
begin
  select * into v_rule
    from public.booking_revenue_terms(new.pickup_at, new.return_at, new.daily_rate);

  new.rental_days := v_rule.rental_days;
  new.paid_days := v_rule.paid_days;
  new.gross_revenue := v_rule.gross_revenue;
  new.revenue_flag := v_rule.revenue_flag;
  new.partner_share := null;
  new.platform_share := null;
  new.launch_credit := 0;
  new.launch_credit_balance := null;

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

  new.commercial_terms_id := v_terms.id;
  -- The split of the standard share; booking_shares() is the one place that rounds.
  select s.partner_share into v_standard
    from public.booking_shares(new.gross_revenue, v_terms.partner_share_percent) s;
  v_partner := v_standard;

  if v_terms.launch_credit_target is not null then
    -- One completion of this partner at a time (E4): the next one waits here and then reads the
    -- balance with this one in it.
    perform 1 from public.partners p where p.id = new.partner_id for update;

    select coalesce(sum(b.launch_credit), 0)
      into v_others
      from public.bookings b
     where b.partner_id = new.partner_id
       and b.status = 'completed'
       and b.id <> new.id;

    if old.status = 'completed' then
      -- Replayed at its own place; launch applies only if it applied the first time.
      v_launch := old.launch_credit_balance is not null;
      v_before := old.launch_credit_balance - old.launch_credit;
    else
      v_before := v_others;
      v_launch := v_before < v_terms.launch_credit_target;
    end if;

    if v_launch then
      select s.partner_share into v_partner
        from public.booking_shares(new.gross_revenue, v_terms.launch_partner_share_percent) s;
      new.launch_credit := v_partner - v_standard;
      new.launch_credit_balance := v_before + new.launch_credit;
    end if;

    -- The copy for display on the terms in use: the sum of the credit of the partner.
    update public.partner_commercial_terms t
       set launch_credit_accumulated = v_others + new.launch_credit,
           launch_mode = (v_others + new.launch_credit) < v_terms.launch_credit_target
     where t.id = v_terms.id;
  end if;

  select s.partner_share, s.platform_share into new.partner_share, new.platform_share
    from public.booking_shares(new.gross_revenue, case when v_launch then v_terms.launch_partner_share_percent else v_terms.partner_share_percent end) s;

  return new;
end;
$$;

revoke execute on function public.apply_booking_revenue_on_completion() from public;
revoke execute on function public.apply_booking_revenue_on_completion() from anon;

-- -----------------------------------------------------------------------------
-- launch_credit and launch_credit_balance join the finance fields that only the booking
-- functions can change.
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
     or new.launch_credit is distinct from old.launch_credit
     or new.launch_credit_balance is distinct from old.launch_credit_balance
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

-- -----------------------------------------------------------------------------
-- set_partner_commercial_terms(): launch_mode of the new version.
-- -----------------------------------------------------------------------------
create or replace function public.set_partner_commercial_terms(
  p_partner_id uuid,
  p_partner_share numeric,
  p_launch_partner_share numeric,
  p_effective_from date,
  p_launch_credit_target numeric,
  p_annual_fee numeric,
  p_onboarding_fee numeric,
  p_vat_rate numeric,
  p_payment_terms_days integer
)
returns public.partner_commercial_terms
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- numeric(12,2) holds up to 9999999999.99
  c_money_limit constant numeric := 10000000000;
  v_latest public.partner_commercial_terms;
  v_row public.partner_commercial_terms;
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_partner_id is null
     or p_partner_share is null
     or p_launch_partner_share is null
     or p_effective_from is null
     or p_annual_fee is null
     or p_onboarding_fee is null
     or p_vat_rate is null
     or p_payment_terms_days is null then
    raise exception 'A value is missing' using errcode = '22023';
  end if;

  -- Locking the partner serializes two saves for the same partner.
  perform 1 from public.partners p where p.id = p_partner_id for update;
  if not found then
    raise exception 'Partner not found' using errcode = 'P0002';
  end if;

  if p_partner_share < 0 or p_partner_share > 100
     or p_partner_share <> round(p_partner_share, 2) then
    raise exception 'The partner share must be from 0 to 100 with at most 2 decimals'
      using errcode = 'TC001';
  end if;

  if p_launch_partner_share < 0 or p_launch_partner_share > 100
     or p_launch_partner_share <> round(p_launch_partner_share, 2)
     or p_launch_partner_share < p_partner_share then
    raise exception 'The launch share must be from 0 to 100 and not below the partner share'
      using errcode = 'TC002';
  end if;

  if p_launch_credit_target is not null
     and (p_launch_credit_target < 0
          or p_launch_credit_target >= c_money_limit
          or p_launch_credit_target <> round(p_launch_credit_target, 2)) then
    raise exception 'The launch credit target must be zero or more with at most 2 decimals'
      using errcode = 'TC005';
  end if;

  if p_annual_fee < 0 or p_annual_fee >= c_money_limit
     or p_annual_fee <> round(p_annual_fee, 2)
     or p_onboarding_fee < 0 or p_onboarding_fee >= c_money_limit
     or p_onboarding_fee <> round(p_onboarding_fee, 2) then
    raise exception 'The fees must be zero or more with at most 2 decimals'
      using errcode = 'TC006';
  end if;

  if p_vat_rate < 0 or p_vat_rate > 100 or p_vat_rate <> round(p_vat_rate, 2) then
    raise exception 'The VAT rate must be from 0 to 100 with at most 2 decimals'
      using errcode = 'TC007';
  end if;

  if p_payment_terms_days < 0 or p_payment_terms_days > 3650 then
    raise exception 'The payment terms must be a whole number of days from 0 to 3650'
      using errcode = 'TC008';
  end if;

  if p_effective_from < current_date then
    raise exception 'The effective date cannot be in the past' using errcode = 'TC003';
  end if;

  select *
    into v_latest
    from public.partner_commercial_terms t
   where t.partner_id = p_partner_id
   order by t.effective_from desc
   limit 1
     for update;

  if found then
    if p_effective_from <= v_latest.effective_from then
      raise exception 'The effective date must be after the start of the latest terms'
        using errcode = 'TC004';
    end if;

    if v_latest.effective_to is null then
      update public.partner_commercial_terms
         set effective_to = p_effective_from - 1
       where id = v_latest.id;
    end if;
  end if;

  insert into public.partner_commercial_terms (
    partner_id,
    partner_share_percent,
    platform_share_percent,
    launch_partner_share_percent,
    launch_mode,
    launch_credit_target,
    launch_credit_accumulated,
    annual_fee,
    onboarding_fee,
    vat_rate_percent,
    payment_terms_days,
    effective_from
  )
  values (
    p_partner_id,
    p_partner_share,
    100 - p_partner_share,
    p_launch_partner_share,
    -- Launch terms are active while there is a target the balance has not reached.
    (p_launch_credit_target is not null
       and coalesce(v_latest.launch_credit_accumulated, 0) < p_launch_credit_target),
    p_launch_credit_target,
    coalesce(v_latest.launch_credit_accumulated, 0),
    p_annual_fee,
    p_onboarding_fee,
    p_vat_rate,
    p_payment_terms_days,
    p_effective_from
  )
  returning * into v_row;

  return v_row;
end;
$$;
