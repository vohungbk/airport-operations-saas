-- LOCAL ONLY: invoices and completed bookings to try VI-F09 (invoice list, detail, PDF, statement). It is not in
-- `[db.seed]`, so a reset does not load it; run it by hand on a local database that has the demo seed.
-- It only adds, and each part (a partner and a month) is skipped when it is already there, so it can run again.
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/seeds/local-invoices.sql
-- It leaves August 2026 alone: the RLS integration test makes its own August settlements for these two partners.
-- `npm run demo:reset` wipes it: run it again after.

begin;

select set_config('app.booking_change', 'on', true);

do $seed$
declare
  v_dcr constant uuid := 'b0000000-0000-0000-0000-000000000001';
  v_dmo uuid;
  v_airport constant uuid := 'a0000000-0000-0000-0000-000000000001';
  v_category constant uuid := 'c0000000-0000-0000-0000-000000000004';
  v_admin uuid;
  v_pickup timestamptz;
  v_return timestamptz;
  v_month date;
  v_partner uuid;
  v_count integer;
  v_prefix text;
  v_number text;
  i integer;
begin
  select id into v_dmo from public.partners where code = 'DMO';
  select id into v_admin from public.users where email = 'admin@airportops.example';

  -- Completed rentals: DCR September (30), DMO September (12), DCR October (1150, more than one batch of the statement).
  for v_month, v_partner, v_count in
    values ('2026-09-01'::date, v_dcr, 30), ('2026-09-01', v_dmo, 12), ('2026-10-01', v_dcr, 1150)
  loop
    v_prefix := 'BK-S' || to_char(v_month, 'MM') || case when v_partner = v_dcr then 'C' else 'M' end;

    if exists (select 1 from public.bookings where booking_number like v_prefix || '%') then
      continue;
    end if;

    for i in 1..v_count loop
      v_pickup := v_month + ((i % 24) || ' days')::interval + ((6 + i % 10) || ' hours')::interval;
      v_return := v_pickup + ((1 + i % 5) || ' days')::interval;
      v_number := v_prefix || lpad(i::text, 5, '0');

      insert into public.bookings (booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate)
      values (v_number, v_partner, v_airport, v_pickup, v_return, v_category, 60 + (i % 4) * 10);

      update public.bookings
         set status = 'completed',
             actual_return_at = case when i % 10 = 3 then v_return - interval '1 day' else null end
       where booking_number = v_number;
    end loop;
  end loop;

  -- The settlements, made by the function of the app as the admin.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  for v_month, v_partner in
    values ('2026-09-01'::date, v_dcr), ('2026-09-01', v_dmo), ('2026-10-01', v_dcr)
  loop
    if not exists (select 1 from public.settlements where partner_id = v_partner and period_start = v_month) then
      perform public.generate_monthly_settlement(v_partner, v_month);
    end if;
  end loop;
end
$seed$;

-- The invoices: the platform share of each settlement plus 5 % VAT, with its lines. September of Demo Car Rental is
-- paid, September of Demo Mobility is overdue, October of Demo Car Rental is issued.
with new_invoices as (
  insert into public.invoices (partner_id, settlement_id, invoice_number, issue_date, due_date, subtotal, vat, total, status)
  select s.partner_id, s.id,
         'INV-2026-' || lpad((
           (select coalesce(max(substring(invoice_number from '[0-9]+$')::integer), 99) from public.invoices where invoice_number like 'INV-2026-%')
           + row_number() over (order by s.period_start, s.partner_id)
         )::text, 6, '0'),
         (s.period_start + interval '1 month')::date,
         (s.period_start + interval '1 month' + interval '30 days')::date,
         s.platform_share,
         round(s.platform_share * 0.05, 2),
         s.platform_share + round(s.platform_share * 0.05, 2),
         case
           when s.period_start = '2026-10-01' then 'issued'
           when p.code = 'DMO' then 'overdue'
           else 'paid'
         end::public.invoice_status
    from public.settlements s
    join public.partners p on p.id = s.partner_id
   where s.period_start >= '2026-09-01'
     and not exists (select 1 from public.invoices i where i.settlement_id = s.id)
  returning id, settlement_id
)
insert into public.invoice_lines (invoice_id, position, description, amount, counts_toward_subtotal)
select n.id, l.position, l.description, l.amount, l.counts
  from new_invoices n
  join public.settlements s on s.id = n.settlement_id
  cross join lateral (values
    (1, 'Gross revenue', s.gross_revenue, false),
    (2, 'Partner share', s.partner_share, false),
    (3, 'Platform share', s.platform_share, true)
  ) as l(position, description, amount, counts);

commit;
