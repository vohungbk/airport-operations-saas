-- VI-F04-S04: paid days are capped at six (spec VI-F04 R10, E1, E2).
--
-- When a rental is completed: paid days = the smaller of the actual rental days and 6, and the
-- gross revenue = paid days x the daily rate. The actual duration is kept: pickup_at and
-- return_at are not touched, and the number of rental days is stored in rental_days, not capped.
--
-- Rental days (assumption, spec has no rule): every 24 hours that has started counts as a day,
-- counted from pickup_at to return_at, so 24 hours is 1 day and 24 hours and 1 second is 2 days.
-- It does not depend on a time zone. To be confirmed by the product owner.
--
-- A rental with no duration (return_at = pickup_at; the table already refuses a return before the
-- pickup) is flagged: rental_days 0, paid_days 0, gross_revenue null (not calculated) and
-- revenue_flag = 'invalid_duration'. It is charged once the period is corrected and the
-- calculation runs again.
--
-- The rule lives in one function, booking_revenue_terms(), used by the trigger and by the
-- backfill below. The trigger runs when the status becomes completed, and again when the period
-- or the daily rate of a completed booking changes (a correction). Nothing sets a booking to
-- completed yet (the return chain, F14 and F15, does); the trigger makes any such path apply the
-- rule. The six is the constant c_paid_days_cap below, and a check keeps paid_days at 6 or less
-- whatever writes it. Change both here if the cap changes.
--
-- rental_days and revenue_flag, like the other finance fields, can only be changed inside the
-- booking functions (guard_booking_update()).
--
-- Rollback: drop trigger set_booking_revenue_on_completion on public.bookings;
--   drop function public.apply_booking_revenue_on_completion();
--   drop function public.booking_revenue_terms(timestamptz, timestamptz, numeric);
--   alter table public.bookings drop constraint bookings_paid_days_cap_check,
--     drop constraint bookings_rental_days_check, drop constraint bookings_revenue_flag_check,
--     drop column rental_days, drop column revenue_flag;
--   then put the body of guard_booking_update() back from 20261002070734_booking_numbering_event_log_and_guards.sql.

alter table public.bookings
  add column rental_days integer,
  add column revenue_flag text,
  add constraint bookings_rental_days_check check (rental_days is null or rental_days >= 0),
  add constraint bookings_revenue_flag_check check (revenue_flag is null or revenue_flag = 'invalid_duration');

-- -----------------------------------------------------------------------------
-- The rule, in one place.
-- -----------------------------------------------------------------------------
create function public.booking_revenue_terms(
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_daily_rate numeric
)
returns table (rental_days integer, paid_days integer, gross_revenue numeric, revenue_flag text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  -- The most days a customer is charged for (spec VI-F04 R10).
  c_paid_days_cap constant integer := 6;
  v_days integer;
begin
  if p_return_at > p_pickup_at then
    v_days := ceil(extract(epoch from (p_return_at - p_pickup_at)) / 86400)::integer;
  else
    v_days := 0;
  end if;

  if v_days = 0 then
    return query select 0, 0, null::numeric, 'invalid_duration'::text;
  else
    return query select
      v_days,
      least(v_days, c_paid_days_cap),
      least(v_days, c_paid_days_cap) * p_daily_rate,
      null::text;
  end if;
end;
$$;

revoke execute on function public.booking_revenue_terms(timestamptz, timestamptz, numeric) from public;
revoke execute on function public.booking_revenue_terms(timestamptz, timestamptz, numeric) from anon;
grant execute on function public.booking_revenue_terms(timestamptz, timestamptz, numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- Trigger: apply the rule when a rental is completed (and when a completed one is corrected).
-- Named so that it runs after guard_bookings_update, which compares the new row with the old.
-- -----------------------------------------------------------------------------
create function public.apply_booking_revenue_on_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_terms record;
begin
  select * into v_terms
    from public.booking_revenue_terms(new.pickup_at, new.return_at, new.daily_rate);

  new.rental_days := v_terms.rental_days;
  new.paid_days := v_terms.paid_days;
  new.gross_revenue := v_terms.gross_revenue;
  new.revenue_flag := v_terms.revenue_flag;

  return new;
end;
$$;

revoke execute on function public.apply_booking_revenue_on_completion() from public;
revoke execute on function public.apply_booking_revenue_on_completion() from anon;

create trigger set_booking_revenue_on_completion
  before update on public.bookings
  for each row
  when (
    new.status = 'completed'
    and (
      old.status is distinct from 'completed'
      or old.pickup_at is distinct from new.pickup_at
      or old.return_at is distinct from new.return_at
      or old.daily_rate is distinct from new.daily_rate
    )
  )
  execute function public.apply_booking_revenue_on_completion();

-- -----------------------------------------------------------------------------
-- The finance fields cannot be changed outside the booking functions: rental_days and
-- revenue_flag join paid_days and gross_revenue. The rest is the guard of 20261002070734.
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
-- Rentals that are already completed get the rule too. The booking functions' flag lets the
-- guard through; no column the booking history records is changed, so no event is written.
-- -----------------------------------------------------------------------------
select set_config('app.booking_change', 'on', true);

update public.bookings b
   set (rental_days, paid_days, gross_revenue, revenue_flag) = (
     select r.rental_days, r.paid_days, r.gross_revenue, r.revenue_flag
       from public.booking_revenue_terms(b.pickup_at, b.return_at, b.daily_rate) r
   )
 where b.status = 'completed';

select set_config('app.booking_change', '', true);

-- paid_days is never above the cap (checked after the backfill).
alter table public.bookings
  add constraint bookings_paid_days_cap_check check (paid_days <= 6);
