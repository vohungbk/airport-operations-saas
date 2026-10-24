import { dbContainer, runSql } from "@/lib/db-test-support";

/**
 * Test support for the finance suites that run against the local database: they complete a
 * booking inside a transaction that is rolled back and read what the rules wrote. Nothing in the
 * app imports it.
 */
export const available = dbContainer() !== null && runSql("select 1;")?.ok === true;

export const PARTNER = "b0000000-0000-0000-0000-000000000001";
export const AIRPORT = "a0000000-0000-0000-0000-000000000001";
export const CATEGORY = "c0000000-0000-0000-0000-000000000001";

/**
 * The partner of these tests has terms in force, whatever the database holds: the demo data has
 * them, a database without it does not. The row is made inside the transaction and rolled back.
 */
const TERMS_IF_MISSING = `
  insert into public.partner_commercial_terms (partner_id, effective_from)
  select '${PARTNER}', date '2000-01-01'
   where not exists (
     select 1 from public.partner_commercial_terms t
      where t.partner_id = '${PARTNER}' and t.effective_from <= current_date
        and (t.effective_to is null or t.effective_to >= current_date));`;

/** Runs a script in a transaction that is rolled back, and returns its `R|...` notices. */
export function run(script: string): string[][] {
  const result = runSql(`begin;\n${TERMS_IF_MISSING}\n${script}\nrollback;`);
  if (!result?.ok) throw new Error(result?.output ?? "docker is not available");
  return result.output
    .split("\n")
    .map((line) => /R\|(.*)$/.exec(line)?.[1])
    .filter((row): row is string => row !== undefined)
    .map((row) => row.split("|"));
}

export const insertBooking = (id: string, pickup: string, ret: string, rate: string) =>
  `insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate)
   values ('${id}', 'PD-${id.slice(-4)}', '${PARTNER}', '${AIRPORT}', '${pickup}', '${ret}', '${CATEGORY}', ${rate});`;

export const FLAG_ON = `select set_config('app.booking_change', 'on', true);`;

/** Inserts a booking, completes it, and reports what the rule wrote. */
export const complete = (name: string, id: string, pickup: string, ret: string, rate: string) => `
  ${insertBooking(id, pickup, ret, rate)}
  ${FLAG_ON}
  update public.bookings set status = 'completed' where id = '${id}';
  do $$ declare b record; begin
    select * into b from public.bookings where id = '${id}';
    raise notice 'R|${name}|%|%|%|%|%|%', b.rental_days, b.paid_days, coalesce(b.gross_revenue::text, 'null'),
      coalesce(b.revenue_flag, 'null'), b.pickup_at, b.return_at;
  end $$;`;

