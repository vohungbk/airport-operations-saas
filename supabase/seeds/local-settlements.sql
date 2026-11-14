-- LOCAL ONLY: settlements in every status, to try the Settlements list (filters, status badges, pages).
-- It is not in `[db.seed]`, so a reset does not load it; run it by hand on a local database that has the demo seed.
-- It only adds: 12 settlements (Demo Car Rental and Demo Mobility, May to October 2026, 10 per page so there are two
-- pages). A partner and month that already has a settlement is skipped, so it can run again. The number
-- (SET-2026-NNNN) is given by the database. The rows are inserted with their status; the guard of
-- the status only watches updates, so move_settlement_status() is not needed here.
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/seeds/local-settlements.sql
-- Linked cloud project (Supabase CLI, no extra setup):
--   npx supabase db query --remote -f supabase/seeds/local-settlements.sql
-- `npm run demo:reset` wipes it: run it again after.
-- Rollback: delete from public.settlements where partner_id in (select id from public.partners where code in ('DCR', 'DMO'))
--   and period_start between '2026-05-01' and '2026-10-01';  (only if no invoice uses them)

begin;

insert into public.settlements (
  partner_id, period_start, period_end, gross_revenue, partner_share, platform_share,
  refunds, adjustments, chargebacks, launch_credit, fees, final_amount, status,
  status_changed_by, status_changed_at
)
select p.id,
       v.period_start,
       (v.period_start + interval '1 month - 1 day')::date,
       v.gross,
       round(v.gross / 2, 2),
       v.gross - round(v.gross / 2, 2),
       0,
       v.adjustments,
       0,
       0,
       0,
       round(v.gross / 2, 2),
       v.status::public.settlement_status,
       case when v.status = 'draft' then null else (select id from public.users where email = 'admin@airportops.example') end,
       v.period_start + interval '1 month' + interval '3 days'
  from (
    values
      ('DCR', '2026-10-01'::date, 11865.00, 0.00, 'pending_approval'),
      ('DMO', '2026-10-01', 7560.00, 0.00, 'draft'),
      ('DCR', '2026-09-01', 18900.00, 0.00, 'approved'),
      ('DMO', '2026-09-01', 12600.00, 0.00, 'paid'),
      ('DCR', '2026-08-01', 16240.00, 120.00, 'paid'),
      ('DMO', '2026-08-01', 9800.00, 0.00, 'paid'),
      ('DCR', '2026-07-01', 15110.00, 0.00, 'paid'),
      ('DMO', '2026-07-01', 8430.00, 60.00, 'approved'),
      ('DCR', '2026-06-01', 13950.00, 0.00, 'paid'),
      ('DMO', '2026-06-01', 7120.00, 0.00, 'pending_approval'),
      ('DCR', '2026-05-01', 12480.00, 0.00, 'paid'),
      ('DMO', '2026-05-01', 6890.00, 0.00, 'draft')
  ) as v(code, period_start, gross, adjustments, status)
  join public.partners p on p.code = v.code
 where not exists (
   select 1 from public.settlements s where s.partner_id = p.id and s.period_start = v.period_start
 )
 order by v.period_start, v.code;

commit;
