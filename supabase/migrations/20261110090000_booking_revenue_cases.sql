-- VI-F04-S07: early returns, cancellations and no-shows are priced by rule, and the case is kept
-- on the booking (spec VI-F04 R14).
--
-- The rule for each case (spec Q3 is open; the answer below is an assumption to be confirmed by the
-- product owner, and it lives in one place, booking_case_revenue()):
--   * cancelled and no_show: not charged. Paid days 0, gross revenue 0.00, both shares 0.00, no launch
--     credit, no terms used.
--   * early_return: the rental is charged for the time it really lasted, with the rule of the six-day
--     cap (every started 24 hours is a day, at most 6). The real return time is actual_return_at; the
--     workflow that completes a rental (the return chain, F14 and F15) will write it. With no return
--     time, or a later one, the rental is charged as it was: a late return is charged for the time it
--     really lasted, still up to 6 days.
--   * standard: as VI-F04-S04 to S06.
-- revenue_case keeps the case: standard, early_return, cancelled or no_show. It is set when the
-- booking is completed, cancelled or marked as a no-show. Refunds and chargebacks (spec Q3, Q4) are
-- not handled here (VI-F04-S09 to S11).
--
-- actual_return_at is nullable and not before the pickup; a return at the pickup is a rental with no
-- duration (flag invalid_duration). Like the other finance fields, revenue_case and actual_return_at
-- can only be changed in the booking functions. A completed booking is calculated again if its
-- actual_return_at changes.
--
-- Rollback: put the bodies of apply_booking_revenue_on_completion() and guard_booking_update() back from
--   20261109090000_launch_credit.sql, recreate the trigger set_booking_revenue_on_completion without
--   the actual_return_at line, then drop trigger set_booking_revenue_on_cancellation on public.bookings;
--   drop function public.apply_booking_revenue_on_cancellation();
--   drop function public.booking_case_revenue(text);
--   alter table public.bookings drop constraint bookings_revenue_case_check,
--     drop constraint bookings_actual_return_check, drop column revenue_case, drop column actual_return_at.

alter table public.bookings
  add column revenue_case text,
  add column actual_return_at timestamptz,
  add constraint bookings_revenue_case_check
    check (revenue_case is null or revenue_case in ('standard', 'early_return', 'cancelled', 'no_show')),
  add constraint bookings_actual_return_check
    check (actual_return_at is null or actual_return_at >= pickup_at);

-- -----------------------------------------------------------------------------
-- The rule for a booking that was cancelled or was a no-show, in one place.
-- -----------------------------------------------------------------------------
create function public.booking_case_revenue(p_case text)
returns table (paid_days integer, gross_revenue numeric)
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_case in ('cancelled', 'no_show') then
    -- Not charged (spec Q3, assumption).
    return query select 0, 0.00::numeric;
  else
    raise exception 'No revenue rule for the case %', p_case using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.booking_case_revenue(text) from public;
revoke execute on function public.booking_case_revenue(text) from anon;
grant execute on function public.booking_case_revenue(text) to authenticated;

-- -----------------------------------------------------------------------------
-- A booking that is cancelled or a no-show: the case, and nothing to charge.
-- Named so that it runs after guard_bookings_update.
-- -----------------------------------------------------------------------------
create function public.apply_booking_revenue_on_cancellation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_case record;
begin
  select * into v_case from public.booking_case_revenue(new.status::text);

  new.revenue_case := new.status::text;
  new.rental_days := null;
  new.paid_days := v_case.paid_days;
  new.gross_revenue := v_case.gross_revenue;
  new.partner_share := 0.00;
  new.platform_share := 0.00;
  new.revenue_flag := null;
  new.commercial_terms_id := null;
  new.launch_credit := 0;
  new.launch_credit_balance := null;

  return new;
end;
$$;

revoke execute on function public.apply_booking_revenue_on_cancellation() from public;
revoke execute on function public.apply_booking_revenue_on_cancellation() from anon;

create trigger set_booking_revenue_on_cancellation
  before update on public.bookings
  for each row
  when (
    new.status in ('cancelled', 'no_show')
    and old.status is distinct from new.status
  )
  execute function public.apply_booking_revenue_on_cancellation();

-- -----------------------------------------------------------------------------
-- The completion: the case, and the time the rental really lasted.
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
  -- The rental is charged up to the day it was really returned; with no return time yet, to the
  -- day it was due.
  select * into v_rule
    from public.booking_revenue_terms(new.pickup_at, coalesce(new.actual_return_at, new.return_at), new.daily_rate);

  new.revenue_case :=
    case
      when new.actual_return_at is not null and new.actual_return_at < new.return_at then 'early_return'
      else 'standard'
    end;

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

-- The calculation also runs again when the real return time of a completed booking changes.
drop trigger set_booking_revenue_on_completion on public.bookings;

create trigger set_booking_revenue_on_completion
  before update on public.bookings
  for each row
  when (
    new.status = 'completed'
    and (
      old.status is distinct from 'completed'
      or old.pickup_at is distinct from new.pickup_at
      or old.return_at is distinct from new.return_at
      or old.actual_return_at is distinct from new.actual_return_at
      or old.daily_rate is distinct from new.daily_rate
    )
  )
  execute function public.apply_booking_revenue_on_completion();

-- -----------------------------------------------------------------------------
-- revenue_case and actual_return_at join the finance fields that only the booking functions change.
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
     or new.revenue_case is distinct from old.revenue_case
     or new.actual_return_at is distinct from old.actual_return_at
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
