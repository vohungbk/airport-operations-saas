-- VI-F05-S05: a partner user enters the baseline costs and prices the estimate is built from
-- (spec VI-F05 S3, F2 to F4, V2 to V4, R7).
--
-- One row per partner: the baseline now in force, with the time it was saved and who saved it.
-- Keeping earlier versions is a later story (VI-F05-S08), so a save replaces the row.
--
-- Access:
--   * RLS is on from the start. A partner user reads the row of their own partner, an admin and an
--     operations manager read every row, nobody else reads any.
--   * No INSERT, UPDATE or DELETE policy exists and the table privileges are revoked, so the only
--     way to write is save_partner_baseline_inputs().
--   * That function is SECURITY DEFINER and takes no partner argument: the partner is always the
--     partner of the caller, who must be an active partner_user of an active partner. An admin or
--     an operations manager is refused (spec Q5 is open: internal roles only read).
--
-- Error codes of save_partner_baseline_inputs():
--   42501  the caller is not a partner user of an active partner
--   22023  a value is missing
--   BL001  an amount, a number of minutes or days is below zero, has more than 2 decimals or is too large
--   BL002  a count of seats or enquiries is below zero
--   BL003  a conversion is not from 0 to 100 or has more than 2 decimals
--
-- Rollback: drop function public.save_partner_baseline_inputs(numeric, numeric, numeric, numeric,
--   integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, integer, numeric);
--   drop table public.partner_baseline_inputs;

create table public.partner_baseline_inputs (
  partner_id uuid primary key references public.partners(id) on delete restrict,

  -- Current costs (USD)
  monthly_staff_cost numeric(12,2) not null,
  handling_cost_per_rental numeric(12,2) not null,
  monthly_inventory_cost numeric(12,2) not null,
  programme_inventory_cost numeric(12,2) not null,

  -- Inventory and handling
  owned_seats integer not null,
  average_handling_minutes numeric(12,2) not null,
  hourly_staff_cost numeric(12,2) not null,
  expected_programme_handling_minutes numeric(12,2) not null,

  -- Pricing and conversion
  average_daily_price numeric(12,2) not null,
  average_paid_days numeric(12,2) not null,
  baseline_conversion_percent numeric(5,2) not null,
  programme_conversion_percent numeric(5,2) not null,
  qualified_enquiries integer not null,
  average_contribution_per_rental numeric(12,2) not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null,

  constraint partner_baseline_inputs_amounts_check check (
    monthly_staff_cost >= 0
    and handling_cost_per_rental >= 0
    and monthly_inventory_cost >= 0
    and programme_inventory_cost >= 0
    and average_handling_minutes >= 0
    and hourly_staff_cost >= 0
    and expected_programme_handling_minutes >= 0
    and average_daily_price >= 0
    and average_paid_days >= 0
    and average_contribution_per_rental >= 0
  ),
  constraint partner_baseline_inputs_counts_check check (owned_seats >= 0 and qualified_enquiries >= 0),
  constraint partner_baseline_inputs_conversion_check check (
    baseline_conversion_percent between 0 and 100
    and programme_conversion_percent between 0 and 100
  )
);

create trigger set_partner_baseline_inputs_updated_at
  before update on public.partner_baseline_inputs
  for each row
  execute function set_updated_at();

alter table public.partner_baseline_inputs enable row level security;

create policy "partner_baseline_inputs_select_admin_ops_manager"
  on public.partner_baseline_inputs for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "partner_baseline_inputs_select_partner_user"
  on public.partner_baseline_inputs for select
  to authenticated
  using (partner_id = (select public.current_user_partner_id()));

-- No INSERT, UPDATE or DELETE policy: RLS already blocks them. The grants go too, so the table
-- does not depend on RLS alone (TRUNCATE is not covered by RLS).
revoke insert, update, delete, truncate on public.partner_baseline_inputs from anon, authenticated;

-- -----------------------------------------------------------------------------
-- save_partner_baseline_inputs(): save the baseline of the caller's own partner.
-- -----------------------------------------------------------------------------
create function public.save_partner_baseline_inputs(
  p_monthly_staff_cost numeric,
  p_handling_cost_per_rental numeric,
  p_monthly_inventory_cost numeric,
  p_programme_inventory_cost numeric,
  p_owned_seats integer,
  p_average_handling_minutes numeric,
  p_hourly_staff_cost numeric,
  p_expected_programme_handling_minutes numeric,
  p_average_daily_price numeric,
  p_average_paid_days numeric,
  p_baseline_conversion_percent numeric,
  p_programme_conversion_percent numeric,
  p_qualified_enquiries integer,
  p_average_contribution_per_rental numeric
)
returns public.partner_baseline_inputs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner_id uuid := public.current_partner_user_partner_id();
  v_amount numeric;
  v_row public.partner_baseline_inputs;
begin
  if v_partner_id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_monthly_staff_cost is null
     or p_handling_cost_per_rental is null
     or p_monthly_inventory_cost is null
     or p_programme_inventory_cost is null
     or p_owned_seats is null
     or p_average_handling_minutes is null
     or p_hourly_staff_cost is null
     or p_expected_programme_handling_minutes is null
     or p_average_daily_price is null
     or p_average_paid_days is null
     or p_baseline_conversion_percent is null
     or p_programme_conversion_percent is null
     or p_qualified_enquiries is null
     or p_average_contribution_per_rental is null then
    raise exception 'A value is missing' using errcode = '22023';
  end if;

  foreach v_amount in array array[
    p_monthly_staff_cost, p_handling_cost_per_rental, p_monthly_inventory_cost,
    p_programme_inventory_cost, p_average_handling_minutes, p_hourly_staff_cost,
    p_expected_programme_handling_minutes, p_average_daily_price, p_average_paid_days,
    p_average_contribution_per_rental
  ] loop
    if v_amount < 0 or v_amount > 9999999999.99 or v_amount <> round(v_amount, 2) then
      raise exception 'An amount must be zero or more, with at most 2 decimals'
        using errcode = 'BL001';
    end if;
  end loop;

  if p_owned_seats < 0 or p_qualified_enquiries < 0 then
    raise exception 'A count must be zero or more' using errcode = 'BL002';
  end if;

  if p_baseline_conversion_percent < 0 or p_baseline_conversion_percent > 100
     or p_baseline_conversion_percent <> round(p_baseline_conversion_percent, 2)
     or p_programme_conversion_percent < 0 or p_programme_conversion_percent > 100
     or p_programme_conversion_percent <> round(p_programme_conversion_percent, 2) then
    raise exception 'A conversion must be from 0 to 100, with at most 2 decimals'
      using errcode = 'BL003';
  end if;

  insert into public.partner_baseline_inputs as b (
    partner_id,
    monthly_staff_cost, handling_cost_per_rental, monthly_inventory_cost, programme_inventory_cost,
    owned_seats, average_handling_minutes, hourly_staff_cost, expected_programme_handling_minutes,
    average_daily_price, average_paid_days, baseline_conversion_percent, programme_conversion_percent,
    qualified_enquiries, average_contribution_per_rental,
    updated_by
  )
  values (
    v_partner_id,
    p_monthly_staff_cost, p_handling_cost_per_rental, p_monthly_inventory_cost, p_programme_inventory_cost,
    p_owned_seats, p_average_handling_minutes, p_hourly_staff_cost, p_expected_programme_handling_minutes,
    p_average_daily_price, p_average_paid_days, p_baseline_conversion_percent, p_programme_conversion_percent,
    p_qualified_enquiries, p_average_contribution_per_rental,
    auth.uid()
  )
  on conflict (partner_id) do update set
    monthly_staff_cost = excluded.monthly_staff_cost,
    handling_cost_per_rental = excluded.handling_cost_per_rental,
    monthly_inventory_cost = excluded.monthly_inventory_cost,
    programme_inventory_cost = excluded.programme_inventory_cost,
    owned_seats = excluded.owned_seats,
    average_handling_minutes = excluded.average_handling_minutes,
    hourly_staff_cost = excluded.hourly_staff_cost,
    expected_programme_handling_minutes = excluded.expected_programme_handling_minutes,
    average_daily_price = excluded.average_daily_price,
    average_paid_days = excluded.average_paid_days,
    baseline_conversion_percent = excluded.baseline_conversion_percent,
    programme_conversion_percent = excluded.programme_conversion_percent,
    qualified_enquiries = excluded.qualified_enquiries,
    average_contribution_per_rental = excluded.average_contribution_per_rental,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning b.* into v_row;

  return v_row;
end;
$$;

revoke execute on function public.save_partner_baseline_inputs(
  numeric, numeric, numeric, numeric, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, integer, numeric
) from public;
revoke execute on function public.save_partner_baseline_inputs(
  numeric, numeric, numeric, numeric, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, integer, numeric
) from anon;
grant execute on function public.save_partner_baseline_inputs(
  numeric, numeric, numeric, numeric, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, integer, numeric
) to authenticated;
