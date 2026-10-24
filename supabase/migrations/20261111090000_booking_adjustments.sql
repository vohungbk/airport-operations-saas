-- VI-F04-S10: record a refund, an adjustment or a chargeback on a booking (spec VI-F04 S3, R5, R15,
-- R16, R17, V7 to V9, E6, E7).
--
-- booking_adjustments is the financial history: one row for each adjustment, with the type, the
-- amount (positive, at most 2 decimals), the reason, who recorded it and when. Nobody can change or
-- delete a row (R16), the service role included. A row is written only by add_booking_adjustment(),
-- never directly: the table has no insert policy.
--
-- add_booking_adjustment() is SECURITY DEFINER and checks the caller itself (an active admin or
-- operations manager, as the Server Action and the page do). The booking must be a completed rental
-- with revenue left to correct; the amount is above zero, has at most 2 decimals and is not above
-- the gross revenue of the booking now (E6, E7); the reason is required (V9) and at most 1000
-- characters. It writes the row, then updates adjustments_total of the booking, which makes the
-- trigger of the revenue calculate the booking again, in the same transaction (A1).
--
-- The calculation: gross revenue = paid days x daily rate + adjustments_total (adjustments_total is
-- zero or negative), never below zero. The partner and platform shares are the split of that gross
-- revenue with the terms the booking kept, so they add up to it. The launch credit is worked out on
-- what the rental earned, before the adjustments, so it does not change when an adjustment is
-- recorded (spec Q4 is open; this keeps the assumption of VI-F04-S06). A change of the period or
-- the rate afterwards keeps the adjustments.
--
-- Whether an adjustment adds or takes away money is one function, booking_adjustment_sign(). All
-- four types take away (assumption: the spec does not say which way a manual adjustment goes).
--
-- Error codes of add_booking_adjustment():
--   42501  the caller is not an active admin or operations manager
--   P0002  the booking does not exist
--   22023  a value is missing
--   BA002  the amount is not above zero, or has more than 2 decimals
--   BA003  the amount is above the gross revenue of the booking
--   BA004  the booking has no revenue to adjust
--   BA005  the reason is empty or longer than 1000 characters
--
-- Rollback: put the bodies of apply_booking_revenue_on_completion() and guard_booking_update() back
--   from 20261110090000_booking_revenue_cases.sql and recreate the trigger
--   set_booking_revenue_on_completion without the adjustments_total line, then
--   drop function public.add_booking_adjustment(uuid, public.booking_adjustment_type, numeric, text);
--   drop table public.booking_adjustments; drop function public.prevent_booking_adjustment_mutation();
--   drop function public.booking_adjustment_sign(public.booking_adjustment_type);
--   drop type public.booking_adjustment_type; alter table public.bookings drop column adjustments_total.

create type public.booking_adjustment_type as enum (
  'partial_refund',
  'full_refund',
  'manual_adjustment',
  'chargeback'
);

alter table public.bookings
  add column adjustments_total numeric(12,2) not null default 0,
  add constraint bookings_adjustments_total_check check (adjustments_total <= 0);

-- Which way an adjustment goes: -1 takes money away. One place to change.
create function public.booking_adjustment_sign(p_type public.booking_adjustment_type)
returns integer
language sql
immutable
set search_path = ''
as $$
  select -1;
$$;

revoke execute on function public.booking_adjustment_sign(public.booking_adjustment_type) from public;
revoke execute on function public.booking_adjustment_sign(public.booking_adjustment_type) from anon;
grant execute on function public.booking_adjustment_sign(public.booking_adjustment_type) to authenticated;

-- -----------------------------------------------------------------------------
-- The history of adjustments: append only.
-- -----------------------------------------------------------------------------
create table public.booking_adjustments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  type public.booking_adjustment_type not null,
  amount numeric(12,2) not null,
  reason text not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint booking_adjustments_amount_check check (amount > 0),
  constraint booking_adjustments_reason_check
    check (btrim(reason) <> '' and char_length(reason) <= 1000)
);

create index booking_adjustments_booking_id_idx on public.booking_adjustments(booking_id, created_at);

create function public.prevent_booking_adjustment_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'booking_adjustments is append-only' using errcode = '55000';
  end if;

  -- The only change allowed: the action "on delete set null" that clears created_by when a user is
  -- deleted (it runs as a nested trigger).
  if pg_trigger_depth() > 1
     and new.created_by is null
     and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then
    return new;
  end if;

  raise exception 'booking_adjustments is append-only' using errcode = '55000';
end;
$$;

revoke execute on function public.prevent_booking_adjustment_mutation() from public;
revoke execute on function public.prevent_booking_adjustment_mutation() from anon;

create trigger prevent_booking_adjustments_update
  before update on public.booking_adjustments
  for each row
  execute function public.prevent_booking_adjustment_mutation();

create trigger prevent_booking_adjustments_delete
  before delete on public.booking_adjustments
  for each row
  execute function public.prevent_booking_adjustment_mutation();

create trigger prevent_booking_adjustments_truncate
  before truncate on public.booking_adjustments
  for each statement
  execute function public.prevent_booking_adjustment_mutation();

alter table public.booking_adjustments enable row level security;

-- Admin and operations manager read all; a partner user reads the adjustments of the bookings of its
-- own partner. There is no insert, update or delete policy: only the function below writes.
create policy "booking_adjustments_select_admin_ops_manager"
  on public.booking_adjustments for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "booking_adjustments_select_partner_user"
  on public.booking_adjustments for select
  to authenticated
  using (public.booking_partner_id(booking_id) = (select public.current_user_partner_id()));

-- -----------------------------------------------------------------------------
-- The revenue calculation, now with the adjustments, and calculated again when they change.
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
  v_base numeric;
  v_adjust numeric;
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
  -- What the rental earned, and then what is left after the adjustments (refunds and the like).
  -- The launch credit is worked out on what the rental earned; the shares on what is left.
  v_base := v_rule.gross_revenue;
  select coalesce(sum(public.booking_adjustment_sign(a.type) * a.amount), 0)
    into v_adjust
    from public.booking_adjustments a
   where a.booking_id = new.id;
  new.adjustments_total := v_adjust;
  new.gross_revenue := case when v_base is null then null else greatest(v_base + v_adjust, 0) end;
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
    from public.booking_shares(v_base, v_terms.partner_share_percent) s;
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
        from public.booking_shares(v_base, v_terms.launch_partner_share_percent) s;
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
      or old.adjustments_total is distinct from new.adjustments_total
    )
  )
  execute function public.apply_booking_revenue_on_completion();

-- -----------------------------------------------------------------------------
-- adjustments_total joins the finance fields that only the booking functions can change.
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
     or new.adjustments_total is distinct from old.adjustments_total
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

-- -----------------------------------------------------------------------------
-- add_booking_adjustment(): record an adjustment and calculate the booking again.
-- -----------------------------------------------------------------------------
create function public.add_booking_adjustment(
  p_booking_id uuid,
  p_type public.booking_adjustment_type,
  p_amount numeric,
  p_reason text
)
returns public.booking_adjustments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_booking public.bookings;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_row public.booking_adjustments;
begin
  select u.role
    into v_role
    from public.users u
   where u.id = v_uid
     and u.is_active;

  if v_role is null or v_role not in ('admin', 'operations_manager') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_booking_id is null or p_type is null or p_amount is null then
    raise exception 'A value is missing' using errcode = '22023';
  end if;

  -- Locking the booking serializes two adjustments of the same booking.
  select *
    into v_booking
    from public.bookings b
   where b.id = p_booking_id
     for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if coalesce(v_booking.revenue_case, '') not in ('standard', 'early_return')
     or v_booking.revenue_flag = 'invalid_duration'
     or v_booking.gross_revenue is null
     or v_booking.gross_revenue <= 0 then
    raise exception 'The booking has no revenue to adjust' using errcode = 'BA004';
  end if;

  if p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'The amount must be above zero with at most 2 decimals' using errcode = 'BA002';
  end if;

  if p_amount > v_booking.gross_revenue then
    raise exception 'The amount is above the gross revenue of the booking' using errcode = 'BA003';
  end if;

  if v_reason = '' or char_length(v_reason) > 1000 then
    raise exception 'The reason is required and at most 1000 characters' using errcode = 'BA005';
  end if;

  insert into public.booking_adjustments (booking_id, type, amount, reason, created_by)
  values (p_booking_id, p_type, p_amount, v_reason, v_uid)
  returning * into v_row;

  -- The change of adjustments_total makes the trigger of the revenue calculate the booking again.
  perform set_config('app.booking_change', 'on', true);

  update public.bookings b
     set adjustments_total = (
       select coalesce(sum(public.booking_adjustment_sign(a.type) * a.amount), 0)
         from public.booking_adjustments a
        where a.booking_id = b.id
     )
   where b.id = p_booking_id;

  perform set_config('app.booking_change', '', true);

  return v_row;
end;
$$;

revoke execute on function public.add_booking_adjustment(uuid, public.booking_adjustment_type, numeric, text) from public;
revoke execute on function public.add_booking_adjustment(uuid, public.booking_adjustment_type, numeric, text) from anon;
grant execute on function public.add_booking_adjustment(uuid, public.booking_adjustment_type, numeric, text) to authenticated;
