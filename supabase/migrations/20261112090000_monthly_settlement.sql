-- VI-F04-S12: generate a monthly settlement for a partner (spec VI-F04 S4, R6, R7, F10, V10).
--
-- The table settlements (F02) gets the two figures the list of the spec shows and it lacked:
-- chargebacks and fees. A partner has one settlement for each month (unique on partner and the first
-- day of the period), so a month cannot be settled twice.
--
-- generate_monthly_settlement() is SECURITY DEFINER and checks the caller itself (an active admin;
-- the Server Action and the page do the same). It creates a draft settlement from the completed
-- rentals of the partner in the month:
--   * A rental belongs to the month of the day it was really returned; with no return time, of the
--     day it was due (UTC). Only rentals with revenue count (case standard or early return).
--   * gross_revenue, partner_share, platform_share and launch_credit are the sums of the bookings.
--     The gross revenue is already net of the adjustments (VI-F04-S10), so the adjustments are
--     shown, not taken off a second time: refunds = partial and full refunds, chargebacks,
--     adjustments = manual adjustments. They are positive amounts of money taken away.
--   * fees is 0: the annual programme fee has no rule yet (spec F4).
--   * final_amount = partner_share - fees. The launch credit is the extra share already inside
--     partner_share, so it is shown but not added again (assumption, the spec gives no formula).
-- A month with no completed rental is refused, not saved as an empty draft (assumption).
-- The month is any day of the month; the settlement is saved for the whole month. Moving the status
-- (R8) and locking the bookings of an approved settlement (R19, Q5) are other stories.
--
-- Error codes of generate_monthly_settlement():
--   42501  the caller is not an active admin
--   22023  the partner or the month is missing
--   P0002  the partner does not exist
--   ST002  the month is in the future
--   ST003  the partner already has a settlement for the month
--   ST004  the partner has no completed rental in the month
--
-- Rollback: drop function public.generate_monthly_settlement(uuid, date);
--   alter table public.settlements drop constraint settlements_partner_period_unique,
--     drop column chargebacks, drop column fees;

alter table public.settlements
  add column chargebacks numeric(12,2) not null default 0,
  add column fees numeric(12,2) not null default 0,
  add constraint settlements_partner_period_unique unique (partner_id, period_start);

create function public.generate_monthly_settlement(p_partner_id uuid, p_month date)
returns public.settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_start date;
  v_from timestamptz;
  v_to timestamptz;
  v_count integer;
  v_gross numeric;
  v_partner numeric;
  v_platform numeric;
  v_credit numeric;
  v_refunds numeric;
  v_chargebacks numeric;
  v_manual numeric;
  v_row public.settlements;
begin
  select u.role
    into v_role
    from public.users u
   where u.id = v_uid
     and u.is_active;

  if v_role is distinct from 'admin' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_partner_id is null or p_month is null then
    raise exception 'A value is missing' using errcode = '22023';
  end if;

  perform 1 from public.partners p where p.id = p_partner_id;
  if not found then
    raise exception 'Partner not found' using errcode = 'P0002';
  end if;

  v_start := date_trunc('month', p_month)::date;
  if v_start > date_trunc('month', (now() at time zone 'UTC'))::date then
    raise exception 'The month is in the future' using errcode = 'ST002';
  end if;

  if exists (
    select 1 from public.settlements s
     where s.partner_id = p_partner_id and s.period_start = v_start
  ) then
    raise exception 'The partner already has a settlement for this month' using errcode = 'ST003';
  end if;

  v_from := v_start::timestamp at time zone 'UTC';
  v_to := (v_start + interval '1 month')::timestamp at time zone 'UTC';

  select count(*),
         coalesce(sum(b.gross_revenue), 0),
         coalesce(sum(b.partner_share), 0),
         coalesce(sum(b.platform_share), 0),
         coalesce(sum(b.launch_credit), 0)
    into v_count, v_gross, v_partner, v_platform, v_credit
    from public.bookings b
   where b.partner_id = p_partner_id
     and b.status = 'completed'
     and b.revenue_case in ('standard', 'early_return')
     and b.gross_revenue is not null
     and coalesce(b.actual_return_at, b.return_at) >= v_from
     and coalesce(b.actual_return_at, b.return_at) < v_to;

  if v_count = 0 then
    raise exception 'The partner has no completed rental in this month' using errcode = 'ST004';
  end if;

  select coalesce(sum(a.amount) filter (where a.type in ('partial_refund', 'full_refund')), 0),
         coalesce(sum(a.amount) filter (where a.type = 'chargeback'), 0),
         coalesce(sum(a.amount) filter (where a.type = 'manual_adjustment'), 0)
    into v_refunds, v_chargebacks, v_manual
    from public.booking_adjustments a
    join public.bookings b on b.id = a.booking_id
   where b.partner_id = p_partner_id
     and b.status = 'completed'
     and b.revenue_case in ('standard', 'early_return')
     and b.gross_revenue is not null
     and coalesce(b.actual_return_at, b.return_at) >= v_from
     and coalesce(b.actual_return_at, b.return_at) < v_to;

  begin
    insert into public.settlements (
      partner_id, period_start, period_end, gross_revenue, partner_share, platform_share,
      refunds, adjustments, chargebacks, launch_credit, fees, final_amount, status
    )
    values (
      p_partner_id, v_start, (v_start + interval '1 month - 1 day')::date, v_gross, v_partner,
      v_platform, v_refunds, v_manual, v_chargebacks, v_credit, 0, v_partner, 'draft'
    )
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'The partner already has a settlement for this month' using errcode = 'ST003';
  end;

  return v_row;
end;
$$;

revoke execute on function public.generate_monthly_settlement(uuid, date) from public;
revoke execute on function public.generate_monthly_settlement(uuid, date) from anon;
grant execute on function public.generate_monthly_settlement(uuid, date) to authenticated;
