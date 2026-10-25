-- VI-F04-S13: move a settlement through its statuses, lock the bookings of an approved settlement,
-- and carry the adjustments made afterwards to the next settlement (spec VI-F04 R8, R19, E8; Q5 is
-- open, so the rules below are assumptions).
--
-- Status (R8). move_settlement_status() is SECURITY DEFINER and checks that the caller is an active
-- admin. The allowed moves are draft -> pending_approval -> approved -> paid, and pending_approval
-- -> draft (sent back). Approved and paid do not go back. The status, who changed it and when are
-- saved together (status_changed_by, status_changed_at). A trigger refuses a change of those columns
-- outside the function (the admin has an update policy on the table), and refuses a change of the
-- figures of a settlement that is not a draft.
--
-- Locked bookings (R19). A completed rental with revenue belongs to the settlement of its partner
-- and of the month of its real return day (UTC), the same rule as generate_monthly_settlement().
-- While that settlement is approved or paid, any update of the booking is refused (ST007).
--
-- Adjustments after approval (R19, E8). add_booking_adjustment() on a locked booking still records
-- the adjustment (after_settlement = true) but does not touch the booking, so the approved
-- settlement does not change. Its amount is at most the gross revenue of the booking that is left
-- after the earlier adjustments of this kind. The next settlement generated for the partner takes
-- every such adjustment that no settlement has taken yet, whatever the month (settlement_carried_adjustments): the gross
-- revenue goes down by the amount, the partner share by the share the booking kept (rounded to the
-- cent), the platform share by the rest, and the amount is shown as refunds, adjustments or
-- chargebacks. A month with only such adjustments still gets a settlement (the gross revenue may be
-- negative). generate_monthly_settlement() locks the partner row, so two months of one partner are
-- generated one after the other.
--
-- Error codes added: ST006 the move is not allowed, ST007 the booking is in an approved settlement.
--
-- Rollback: put the bodies of add_booking_adjustment() (20261111090000) and
--   generate_monthly_settlement() (20261112090000) back, then
--   drop trigger prevent_settled_booking_change on public.bookings;
--   drop function public.prevent_settled_booking_change(); drop function public.booking_in_closed_settlement(uuid, timestamptz);
--   drop trigger guard_settlement_update on public.settlements; drop function public.guard_settlement_update();
--   drop function public.move_settlement_status(uuid, public.settlement_status);
--   drop table public.settlement_carried_adjustments;
--   alter table public.booking_adjustments drop column after_settlement;
--   alter table public.settlements drop column status_changed_by, drop column status_changed_at;

alter table public.settlements
  add column status_changed_by uuid references public.users(id) on delete set null,
  add column status_changed_at timestamptz not null default now();

alter table public.booking_adjustments
  add column after_settlement boolean not null default false;

-- -----------------------------------------------------------------------------
-- The adjustments a settlement took from earlier months. Written only by
-- generate_monthly_settlement(): there is no insert, update or delete policy.
-- -----------------------------------------------------------------------------
create table public.settlement_carried_adjustments (
  adjustment_id uuid primary key references public.booking_adjustments(id) on delete restrict,
  settlement_id uuid not null references public.settlements(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index settlement_carried_adjustments_settlement_id_idx
  on public.settlement_carried_adjustments(settlement_id);

alter table public.settlement_carried_adjustments enable row level security;

create policy "settlement_carried_adjustments_select_admin_ops_manager"
  on public.settlement_carried_adjustments for select
  to authenticated
  using ((select public.is_admin_or_ops_manager()));

create policy "settlement_carried_adjustments_select_partner_user"
  on public.settlement_carried_adjustments for select
  to authenticated
  using (
    settlement_id in (
      select s.id from public.settlements s where s.partner_id = (select public.current_user_partner_id())
    )
  );

-- -----------------------------------------------------------------------------
-- Is the settlement of a partner and a month approved or paid?
-- -----------------------------------------------------------------------------
create function public.booking_in_closed_settlement(p_partner_id uuid, p_returned_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.settlements s
     where s.partner_id = p_partner_id
       and s.period_start = date_trunc('month', p_returned_at at time zone 'UTC')::date
       and s.status in ('approved', 'paid')
  );
$$;

revoke execute on function public.booking_in_closed_settlement(uuid, timestamptz) from public;
revoke execute on function public.booking_in_closed_settlement(uuid, timestamptz) from anon;
revoke execute on function public.booking_in_closed_settlement(uuid, timestamptz) from authenticated;

-- -----------------------------------------------------------------------------
-- Locked bookings (R19).
-- -----------------------------------------------------------------------------
create function public.prevent_settled_booking_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'completed'
     or coalesce(old.revenue_case, '') not in ('standard', 'early_return')
     or old.gross_revenue is null then
    return new;
  end if;

  -- The seat released by the deletion of the seat is the one change that is not the booking's own.
  if pg_trigger_depth() > 1
     and old.assigned_seat_id is not null
     and new.assigned_seat_id is null
     and (to_jsonb(new) - 'assigned_seat_id' - 'updated_at')
         = (to_jsonb(old) - 'assigned_seat_id' - 'updated_at') then
    return new;
  end if;

  if public.booking_in_closed_settlement(old.partner_id, coalesce(old.actual_return_at, old.return_at)) then
    raise exception 'The booking is in an approved settlement' using errcode = 'ST007';
  end if;

  return new;
end;
$$;

revoke execute on function public.prevent_settled_booking_change() from public;
revoke execute on function public.prevent_settled_booking_change() from anon;

create trigger prevent_settled_booking_change
  before update on public.bookings
  for each row
  execute function public.prevent_settled_booking_change();

-- -----------------------------------------------------------------------------
-- The status of a settlement (R8).
-- -----------------------------------------------------------------------------
create function public.guard_settlement_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_in_move boolean :=
    coalesce(nullif(btrim(current_setting('app.settlement_change', true)), ''), 'off') = 'on';
begin
  -- The action "on delete set null" that clears status_changed_by when a user is deleted.
  if pg_trigger_depth() > 1
     and new.status_changed_by is null
     and (to_jsonb(new) - 'status_changed_by' - 'updated_at')
         = (to_jsonb(old) - 'status_changed_by' - 'updated_at') then
    return new;
  end if;

  if not v_in_move
     and (new.status is distinct from old.status
          or new.status_changed_by is distinct from old.status_changed_by
          or new.status_changed_at is distinct from old.status_changed_at) then
    raise exception 'The status of a settlement can only be changed through move_settlement_status()'
      using errcode = '55000';
  end if;

  if old.status <> 'draft'
     and (new.partner_id is distinct from old.partner_id
          or new.period_start is distinct from old.period_start
          or new.period_end is distinct from old.period_end
          or new.gross_revenue is distinct from old.gross_revenue
          or new.partner_share is distinct from old.partner_share
          or new.platform_share is distinct from old.platform_share
          or new.refunds is distinct from old.refunds
          or new.adjustments is distinct from old.adjustments
          or new.chargebacks is distinct from old.chargebacks
          or new.launch_credit is distinct from old.launch_credit
          or new.fees is distinct from old.fees
          or new.final_amount is distinct from old.final_amount) then
    raise exception 'A settlement that is not a draft cannot be changed' using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_settlement_update() from public;
revoke execute on function public.guard_settlement_update() from anon;

create trigger guard_settlement_update
  before update on public.settlements
  for each row
  execute function public.guard_settlement_update();

create function public.move_settlement_status(p_settlement_id uuid, p_to public.settlement_status)
returns public.settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
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

  if p_settlement_id is null or p_to is null then
    raise exception 'A value is missing' using errcode = '22023';
  end if;

  select *
    into v_row
    from public.settlements s
   where s.id = p_settlement_id
     for update;

  if not found then
    raise exception 'Settlement not found' using errcode = 'P0002';
  end if;

  if not (
    (v_row.status = 'draft' and p_to = 'pending_approval')
    or (v_row.status = 'pending_approval' and p_to in ('approved', 'draft'))
    or (v_row.status = 'approved' and p_to = 'paid')
  ) then
    raise exception 'The settlement cannot move from % to %', v_row.status, p_to using errcode = 'ST006';
  end if;

  perform set_config('app.settlement_change', 'on', true);

  update public.settlements s
     set status = p_to,
         status_changed_by = v_uid,
         status_changed_at = now()
   where s.id = p_settlement_id
  returning * into v_row;

  perform set_config('app.settlement_change', '', true);

  return v_row;
end;
$$;

revoke execute on function public.move_settlement_status(uuid, public.settlement_status) from public;
revoke execute on function public.move_settlement_status(uuid, public.settlement_status) from anon;
grant execute on function public.move_settlement_status(uuid, public.settlement_status) to authenticated;

-- -----------------------------------------------------------------------------
-- add_booking_adjustment(): an adjustment on a locked booking is carried, not applied.
-- -----------------------------------------------------------------------------
create or replace function public.add_booking_adjustment(
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
  v_locked boolean;
  v_limit numeric;
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

  -- In an approved settlement the booking does not change: what is left to adjust is the gross
  -- revenue less the adjustments already carried to the next settlement.
  v_locked := v_booking.status = 'completed'
    and public.booking_in_closed_settlement(
      v_booking.partner_id, coalesce(v_booking.actual_return_at, v_booking.return_at));

  v_limit := v_booking.gross_revenue;
  if v_locked then
    select v_limit - coalesce(sum(a.amount), 0)
      into v_limit
      from public.booking_adjustments a
     where a.booking_id = p_booking_id
       and a.after_settlement;
  end if;

  if p_amount > v_limit then
    raise exception 'The amount is above the gross revenue of the booking' using errcode = 'BA003';
  end if;

  if v_reason = '' or char_length(v_reason) > 1000 then
    raise exception 'The reason is required and at most 1000 characters' using errcode = 'BA005';
  end if;

  insert into public.booking_adjustments (booking_id, type, amount, reason, created_by, after_settlement)
  values (p_booking_id, p_type, p_amount, v_reason, v_uid, v_locked)
  returning * into v_row;

  if v_locked then
    return v_row;
  end if;

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

-- -----------------------------------------------------------------------------
-- generate_monthly_settlement(): takes the adjustments carried from earlier months.
-- -----------------------------------------------------------------------------
create or replace function public.generate_monthly_settlement(p_partner_id uuid, p_month date)
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
  v_carried_count integer;
  v_gross numeric;
  v_partner numeric;
  v_platform numeric;
  v_credit numeric;
  v_refunds numeric;
  v_chargebacks numeric;
  v_manual numeric;
  v_c_total numeric;
  v_c_partner numeric;
  v_c_refunds numeric;
  v_c_chargebacks numeric;
  v_c_manual numeric;
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

  -- The partner row is the lock that makes two settlements of one partner run one after the other.
  perform 1 from public.partners p where p.id = p_partner_id for update;
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

  select coalesce(sum(a.amount) filter (where a.type in ('partial_refund', 'full_refund')), 0),
         coalesce(sum(a.amount) filter (where a.type = 'chargeback'), 0),
         coalesce(sum(a.amount) filter (where a.type = 'manual_adjustment'), 0)
    into v_refunds, v_chargebacks, v_manual
    from public.booking_adjustments a
    join public.bookings b on b.id = a.booking_id
   where b.partner_id = p_partner_id
     and not a.after_settlement
     and b.status = 'completed'
     and b.revenue_case in ('standard', 'early_return')
     and b.gross_revenue is not null
     and coalesce(b.actual_return_at, b.return_at) >= v_from
     and coalesce(b.actual_return_at, b.return_at) < v_to;

  -- The adjustments made after the settlement of their own month was approved, that no settlement
  -- has taken yet. The partner share goes down by the share the booking kept.
  select count(*),
         coalesce(sum(a.amount), 0),
         coalesce(sum(case when b.gross_revenue > 0
                           then round(a.amount * coalesce(b.partner_share, 0) / b.gross_revenue, 2)
                           else 0 end), 0),
         coalesce(sum(a.amount) filter (where a.type in ('partial_refund', 'full_refund')), 0),
         coalesce(sum(a.amount) filter (where a.type = 'chargeback'), 0),
         coalesce(sum(a.amount) filter (where a.type = 'manual_adjustment'), 0)
    into v_carried_count, v_c_total, v_c_partner, v_c_refunds, v_c_chargebacks, v_c_manual
    from public.booking_adjustments a
    join public.bookings b on b.id = a.booking_id
   where b.partner_id = p_partner_id
     and a.after_settlement
     and not exists (select 1 from public.settlement_carried_adjustments c where c.adjustment_id = a.id);

  if v_count = 0 and v_carried_count = 0 then
    raise exception 'The partner has no completed rental in this month' using errcode = 'ST004';
  end if;

  v_gross := v_gross - v_c_total;
  v_partner := v_partner - v_c_partner;
  v_platform := v_platform - (v_c_total - v_c_partner);

  begin
    insert into public.settlements (
      partner_id, period_start, period_end, gross_revenue, partner_share, platform_share,
      refunds, adjustments, chargebacks, launch_credit, fees, final_amount, status,
      status_changed_by, status_changed_at
    )
    values (
      p_partner_id, v_start, (v_start + interval '1 month - 1 day')::date, v_gross, v_partner,
      v_platform, v_refunds + v_c_refunds, v_manual + v_c_manual, v_chargebacks + v_c_chargebacks,
      v_credit, 0, v_partner, 'draft', v_uid, now()
    )
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'The partner already has a settlement for this month' using errcode = 'ST003';
  end;

  insert into public.settlement_carried_adjustments (adjustment_id, settlement_id)
  select a.id, v_row.id
    from public.booking_adjustments a
    join public.bookings b on b.id = a.booking_id
   where b.partner_id = p_partner_id
     and a.after_settlement
     and not exists (select 1 from public.settlement_carried_adjustments c where c.adjustment_id = a.id);

  return v_row;
end;
$$;
