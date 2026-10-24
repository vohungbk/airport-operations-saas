-- VI-F04-S02: the launch credit target, the fees, the VAT rate and the payment terms are part
-- of the terms of a partner (spec VI-F04 S1, F3 to F6, V3 to V6).
--
-- They are saved with the shares, in the same version: a settlement or an invoice has to use
-- the amounts that were agreed for its period (E5). So:
--   * vat_rate_percent (default 0) and payment_terms_days (default 14) are new columns;
--   * annual_fee and onboarding_fee become not null with a default of 0 (the table has no real
--     data, a null is read as 0);
--   * each value is checked in the table, and again in set_partner_commercial_terms(), which
--     takes five more arguments and writes them to the new version;
--   * the trigger that keeps a version unchanged now covers them too. launch_mode and
--     launch_credit_accumulated can still be updated (the launch credit story needs that), and
--     so can effective_to.
--
-- The launch credit target stays nullable: empty means no target is set. Money has at most 2
-- decimals and fits numeric(12,2). Currency and rounding are open (spec Q1), and so is how the
-- VAT is applied (Q2): only the rate is kept here.
--
-- Error codes added to the ones of VI-F04-S01:
--   TC005  the launch credit target is not zero or more, or has more than 2 decimals or too many digits
--   TC006  the annual fee or the onboarding credit is missing, below zero, or has more than 2 decimals or too many digits
--   TC007  the VAT rate is not from 0 to 100, or has more than 2 decimals
--   TC008  the payment terms are not a whole number of days from 0 to 3650
--
-- Rollback: put the old body of the function back from 20261105090000_commercial_terms_shares_and_versions.sql
--   (drop the nine-argument function first), put the old body of the trigger function back, then
--   alter table public.partner_commercial_terms drop constraint partner_commercial_terms_launch_credit_target_check,
--     drop constraint partner_commercial_terms_annual_fee_check, drop constraint partner_commercial_terms_onboarding_fee_check,
--     drop constraint partner_commercial_terms_vat_rate_check, drop constraint partner_commercial_terms_payment_terms_check,
--     drop column vat_rate_percent, drop column payment_terms_days,
--     alter column annual_fee drop not null, alter column annual_fee drop default,
--     alter column onboarding_fee drop not null, alter column onboarding_fee drop default;

update public.partner_commercial_terms set annual_fee = 0 where annual_fee is null;
update public.partner_commercial_terms set onboarding_fee = 0 where onboarding_fee is null;

alter table public.partner_commercial_terms
  alter column annual_fee set default 0,
  alter column annual_fee set not null,
  alter column onboarding_fee set default 0,
  alter column onboarding_fee set not null,
  add column vat_rate_percent numeric(5,2) not null default 0,
  add column payment_terms_days integer not null default 14;

alter table public.partner_commercial_terms
  add constraint partner_commercial_terms_launch_credit_target_check
    check (launch_credit_target is null or launch_credit_target >= 0),
  add constraint partner_commercial_terms_annual_fee_check
    check (annual_fee >= 0),
  add constraint partner_commercial_terms_onboarding_fee_check
    check (onboarding_fee >= 0),
  add constraint partner_commercial_terms_vat_rate_check
    check (vat_rate_percent >= 0 and vat_rate_percent <= 100),
  add constraint partner_commercial_terms_payment_terms_check
    check (payment_terms_days >= 0 and payment_terms_days <= 3650);

-- -----------------------------------------------------------------------------
-- A version is history: its terms, its partner and its start cannot change.
-- -----------------------------------------------------------------------------
create or replace function public.guard_partner_commercial_terms_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.partner_id is distinct from old.partner_id
     or new.partner_share_percent is distinct from old.partner_share_percent
     or new.platform_share_percent is distinct from old.platform_share_percent
     or new.launch_partner_share_percent is distinct from old.launch_partner_share_percent
     or new.launch_credit_target is distinct from old.launch_credit_target
     or new.annual_fee is distinct from old.annual_fee
     or new.onboarding_fee is distinct from old.onboarding_fee
     or new.vat_rate_percent is distinct from old.vat_rate_percent
     or new.payment_terms_days is distinct from old.payment_terms_days
     or new.effective_from is distinct from old.effective_from then
    raise exception 'Commercial terms of a version cannot be changed; save new terms instead'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- set_partner_commercial_terms(): now with the launch target, the fees, the VAT and the
-- payment terms.
-- -----------------------------------------------------------------------------
drop function public.set_partner_commercial_terms(uuid, numeric, numeric, date);

create function public.set_partner_commercial_terms(
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
    coalesce(v_latest.launch_mode, false),
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

revoke execute on function public.set_partner_commercial_terms(uuid, numeric, numeric, date, numeric, numeric, numeric, numeric, integer) from public;
revoke execute on function public.set_partner_commercial_terms(uuid, numeric, numeric, date, numeric, numeric, numeric, numeric, integer) from anon;
grant execute on function public.set_partner_commercial_terms(uuid, numeric, numeric, date, numeric, numeric, numeric, numeric, integer) to authenticated;
