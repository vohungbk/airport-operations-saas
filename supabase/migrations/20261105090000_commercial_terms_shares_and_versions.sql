-- VI-F04-S01: configure the commercial terms of a partner (spec VI-F04 S1, F1, F2, V1, V2, R1).
--
-- Before, partner_commercial_terms had a partner share and a platform share that were each
-- checked from 0 to 100 and not tied to each other, no launch share, and no default. Now:
--   * the partner share defaults to 30 and the platform share to 70;
--   * there is a launch partner share, default 50, from 0 to 100 and not below the partner
--     share (V2);
--   * the partner and platform shares add up to 100 (V1);
--   * the terms are versions. Saving through set_partner_commercial_terms() adds a new row
--     with an effective date and closes the previous one, so the terms a completed rental was
--     calculated with are never rewritten (R1, E5). The shares, the partner and the start date
--     of a row cannot be changed afterwards, not even by an admin.
--
-- The launch credit fields (target, accumulated) and the fees belong to later stories
-- (VI-F04-S02, S06): a new version copies them from the previous one unchanged.
--
-- set_partner_commercial_terms() is SECURITY DEFINER and admin only. It checks the caller
-- itself (spec Q1 is open: who may edit terms; the existing RLS already allowed admin only).
-- A new version starts today or later and after the latest version; "today" is the date of
-- the database server (UTC), so the screen gets it from the server too.
--
-- Error codes:
--   42501  the caller is not an admin
--   P0002  the partner does not exist
--   22023  a value is missing
--   TC001  the partner share is not from 0 to 100, or has more than 2 decimals
--   TC002  the launch share is not from 0 to 100, has more than 2 decimals, or is below the
--          partner share
--   TC003  the effective date is in the past
--   TC004  the effective date is not after the start of the latest version
--
-- Rollback: drop function public.set_partner_commercial_terms(uuid, numeric, numeric, date);
--   drop trigger guard_partner_commercial_terms_update on public.partner_commercial_terms;
--   drop function public.guard_partner_commercial_terms_update();
--   alter table public.partner_commercial_terms drop constraint partner_commercial_terms_shares_sum_check,
--     drop constraint partner_commercial_terms_launch_share_check,
--     drop constraint partner_commercial_terms_launch_not_below_partner_check,
--     drop constraint partner_commercial_terms_period_check,
--     drop column launch_partner_share_percent,
--     alter column partner_share_percent drop default, alter column platform_share_percent drop default;

alter table public.partner_commercial_terms
  alter column partner_share_percent set default 30,
  alter column platform_share_percent set default 70,
  add column launch_partner_share_percent numeric(5,2) not null default 50;

-- A row that exists keeps its meaning: its launch share is not below its partner share.
update public.partner_commercial_terms
   set launch_partner_share_percent = greatest(50, partner_share_percent);

alter table public.partner_commercial_terms
  add constraint partner_commercial_terms_launch_share_check
    check (launch_partner_share_percent >= 0 and launch_partner_share_percent <= 100),
  add constraint partner_commercial_terms_launch_not_below_partner_check
    check (launch_partner_share_percent >= partner_share_percent),
  add constraint partner_commercial_terms_shares_sum_check
    check (partner_share_percent + platform_share_percent = 100),
  add constraint partner_commercial_terms_period_check
    check (effective_to is null or effective_to >= effective_from);

-- -----------------------------------------------------------------------------
-- A version is history: its shares, its partner and its start cannot change.
-- -----------------------------------------------------------------------------
create function public.guard_partner_commercial_terms_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.partner_id is distinct from old.partner_id
     or new.partner_share_percent is distinct from old.partner_share_percent
     or new.platform_share_percent is distinct from old.platform_share_percent
     or new.launch_partner_share_percent is distinct from old.launch_partner_share_percent
     or new.effective_from is distinct from old.effective_from then
    raise exception 'Commercial terms of a version cannot be changed; save new terms instead'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger guard_partner_commercial_terms_update
  before update on public.partner_commercial_terms
  for each row
  execute function public.guard_partner_commercial_terms_update();

-- -----------------------------------------------------------------------------
-- set_partner_commercial_terms(): save new terms as a new version.
-- -----------------------------------------------------------------------------
create function public.set_partner_commercial_terms(
  p_partner_id uuid,
  p_partner_share numeric,
  p_launch_partner_share numeric,
  p_effective_from date
)
returns public.partner_commercial_terms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_latest public.partner_commercial_terms;
  v_row public.partner_commercial_terms;
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_partner_id is null
     or p_partner_share is null
     or p_launch_partner_share is null
     or p_effective_from is null then
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
    effective_from
  )
  values (
    p_partner_id,
    p_partner_share,
    100 - p_partner_share,
    p_launch_partner_share,
    coalesce(v_latest.launch_mode, false),
    v_latest.launch_credit_target,
    coalesce(v_latest.launch_credit_accumulated, 0),
    v_latest.annual_fee,
    v_latest.onboarding_fee,
    p_effective_from
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.set_partner_commercial_terms(uuid, numeric, numeric, date) from public;
revoke execute on function public.set_partner_commercial_terms(uuid, numeric, numeric, date) from anon;
grant execute on function public.set_partner_commercial_terms(uuid, numeric, numeric, date) to authenticated;
