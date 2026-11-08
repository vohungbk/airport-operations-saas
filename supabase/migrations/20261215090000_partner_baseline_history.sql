-- VI-F05-S08: keep the earlier baseline inputs of a partner, with the time and the user, so a past
-- estimate stays explainable (spec VI-F05 R14).
--
-- partner_baseline_inputs keeps the baseline now in force (one row per partner, VI-F05-S05). Every time
-- that row is inserted or updated, a trigger writes one row to partner_baseline_input_versions: the values,
-- the time and the user who saved them. A version is never changed or deleted by the app.
--
-- Access:
--   * RLS is on from the start. A partner user reads the versions of their own partner, an admin and an
--     operations manager read every version, nobody else reads any (the same rule as the baseline itself).
--   * No INSERT, UPDATE or DELETE policy exists and the table privileges are revoked, so the only way
--     to write is the trigger, which is SECURITY DEFINER.
--   * The save function and its error codes (42501, 22023, BL001 to BL003) are unchanged. A refused save
--     writes nothing, so it adds no version.
--
-- Rollback: drop trigger keep_partner_baseline_version on public.partner_baseline_inputs;
--   drop function public.keep_partner_baseline_version();
--   drop table public.partner_baseline_input_versions;

create table public.partner_baseline_input_versions (
  id bigint generated always as identity primary key,
  partner_id uuid not null references public.partners(id) on delete restrict,

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

  -- When the version was saved and by whom (null when the user is gone)
  saved_at timestamptz not null,
  saved_by uuid references public.users(id) on delete set null
);

create index partner_baseline_input_versions_partner_saved_idx
  on public.partner_baseline_input_versions (partner_id, saved_at desc, id desc);

alter table public.partner_baseline_input_versions enable row level security;

create policy "partner_baseline_input_versions_select_admin_ops_manager"
  on public.partner_baseline_input_versions for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "partner_baseline_input_versions_select_partner_user"
  on public.partner_baseline_input_versions for select
  to authenticated
  using (partner_id = (select public.current_user_partner_id()));

revoke insert, update, delete, truncate on public.partner_baseline_input_versions from anon, authenticated;

-- -----------------------------------------------------------------------------
-- keep_partner_baseline_version(): write the baseline just saved as a version.
-- -----------------------------------------------------------------------------
create function public.keep_partner_baseline_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.partner_baseline_input_versions (
    partner_id,
    monthly_staff_cost, handling_cost_per_rental, monthly_inventory_cost, programme_inventory_cost,
    owned_seats, average_handling_minutes, hourly_staff_cost, expected_programme_handling_minutes,
    average_daily_price, average_paid_days, baseline_conversion_percent, programme_conversion_percent,
    qualified_enquiries, average_contribution_per_rental,
    saved_at, saved_by
  )
  values (
    new.partner_id,
    new.monthly_staff_cost, new.handling_cost_per_rental, new.monthly_inventory_cost, new.programme_inventory_cost,
    new.owned_seats, new.average_handling_minutes, new.hourly_staff_cost, new.expected_programme_handling_minutes,
    new.average_daily_price, new.average_paid_days, new.baseline_conversion_percent, new.programme_conversion_percent,
    new.qualified_enquiries, new.average_contribution_per_rental,
    new.updated_at, new.updated_by
  );

  return new;
end;
$$;

revoke execute on function public.keep_partner_baseline_version() from public, anon, authenticated;

create trigger keep_partner_baseline_version
  after insert or update on public.partner_baseline_inputs
  for each row
  execute function public.keep_partner_baseline_version();

-- The baselines saved before this story become the first version of their partner.
insert into public.partner_baseline_input_versions (
  partner_id,
  monthly_staff_cost, handling_cost_per_rental, monthly_inventory_cost, programme_inventory_cost,
  owned_seats, average_handling_minutes, hourly_staff_cost, expected_programme_handling_minutes,
  average_daily_price, average_paid_days, baseline_conversion_percent, programme_conversion_percent,
  qualified_enquiries, average_contribution_per_rental,
  saved_at, saved_by
)
select
  partner_id,
  monthly_staff_cost, handling_cost_per_rental, monthly_inventory_cost, programme_inventory_cost,
  owned_seats, average_handling_minutes, hourly_staff_cost, expected_programme_handling_minutes,
  average_daily_price, average_paid_days, baseline_conversion_percent, programme_conversion_percent,
  qualified_enquiries, average_contribution_per_rental,
  updated_at, updated_by
from public.partner_baseline_inputs;
