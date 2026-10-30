import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { findDataRuleGaps } from "@/lib/data-rules/coverage";
import { dbContainer, runSql } from "@/lib/db-test-support";

/**
 * VI-F08-S03 (spec R3): constraints, business rules and history consistency are
 * verified. Runs against the local database. Every statement here is made inside
 * a transaction that is rolled back, so nothing is left behind and other suites
 * are not affected.
 *
 * Constraints: for each CHECK, UNIQUE and standalone unique index of the schema,
 * a row that is just inside the rule is accepted and a row just outside it is
 * refused with the name of that rule. `session_replication_role = replica`
 * switches off the triggers and the foreign keys for these inserts, so a case
 * needs no parent rows and tests the constraint alone; CHECK and UNIQUE stay on.
 * A new constraint with no case fails the last test of the first group.
 *
 * Business rules (the status transitions) are tested with their RPCs in the RLS
 * suite; this file checks that each `change_*` function has such a test. History:
 * the three history tables refuse UPDATE and DELETE even for the database owner.
 *
 * Skipped when the local stack is not running, like the RLS suite.
 */
const available = dbContainer() !== null && runSql("select 1;")?.ok === true;

const uuid = (n: number) => `'c3000000-0000-0000-0000-${String(n).padStart(12, "0")}'`;
const PARTNER = uuid(1);
const AIRPORT = uuid(2);
const CATEGORY = uuid(3);
const SEAT = uuid(4);
const USER = uuid(5);
const BOOKING = uuid(6);

const airport = (code: string) =>
  `insert into public.airports (code, name, city, country, timezone) values ('${code}', 'Test', 'Test', 'Test', 'UTC');`;
const partner = (code: string) =>
  `insert into public.partners (name, code, contact_email) values ('Test', '${code}', 'p@test.example');`;
const booking = (number: string, pickup = "2030-01-01 10:00+00", ret = "2030-01-02 10:00+00", paidDays = 0) =>
  `insert into public.bookings (booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate, paid_days)
   values ('${number}', ${PARTNER}, ${AIRPORT}, '${pickup}', '${ret}', ${CATEGORY}, 10, ${paidDays});`;
/** An adjustment row; the foreign keys are off in these cases, so the booking need not exist. */
const adjustment = (amount: string, reason: string) =>
  `insert into public.booking_adjustments (booking_id, type, amount, reason)
   values ('c3000000-0000-0000-0000-000000000099', 'partial_refund', ${amount}, ${reason});`;
/** A row of the financial history; the foreign keys are off in these cases. */
const financeHistory = (table: string, action: string, reason: string) =>
  `insert into public.finance_history (table_name, row_id, action, reason, new_values)
   values ('${table}', 'c3000000-0000-0000-0000-000000000098', '${action}', ${reason}, '{}'::jsonb);`;
/** A booking with one more column set, for the finance checks of VI-F04-S04. */
const bookingWith = (number: string, column: string, value: string) =>
  `insert into public.bookings (booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate, ${column})
   values ('${number}', ${PARTNER}, ${AIRPORT}, '2030-01-01 10:00+00', '2030-01-02 10:00+00', ${CATEGORY}, 10, ${value});`;
const seat = (serial: string, token: string, maxCycles = 10, cycles = 0) =>
  `insert into public.seats (serial_number, public_token, manufacturer, model, category_id, airport_id, manufacture_date, purchase_date, max_rental_cycles, rental_cycles)
   values ('${serial}', '${token}', 'Test', 'Test', ${CATEGORY}, ${AIRPORT}, '2025-01-01', '2025-02-01', ${maxCycles}, ${cycles});`;
// Postgres checks CHECK constraints in the order of their names, so a case is built so that the
// constraint under test is the first one that fails. The launch share defaults to 100, which is
// never below the partner share.
const terms = (partnerShare: string, platformShare: string, launchShare = "100", effectiveTo = "null") =>
  `insert into public.partner_commercial_terms (partner_id, partner_share_percent, platform_share_percent, launch_partner_share_percent, effective_from, effective_to)
   values (${PARTNER}, ${partnerShare}, ${platformShare}, ${launchShare}, '2030-01-01', ${effectiveTo});`;
/** A row of the terms with one column set, for the constraints of VI-F04-S02. */
const termsWith = (column: string, value: string) =>
  `insert into public.partner_commercial_terms (partner_id, effective_from, ${column}) values (${PARTNER}, '2030-01-01', ${value});`;
const job = (type: string, status: string) =>
  `insert into public.technician_jobs (booking_id, technician_id, job_type, status) values (${BOOKING}, ${USER}, '${type}', '${status}');`;
const user = (email: string) =>
  `insert into public.users (email, full_name, role) values ('${email}', 'Test', 'technician');`;
const inspection = (jobId: string | null, followUp: string | null = null) =>
  `insert into public.inspection_records (seat_id, inspector_id, inspection_type, result, technician_job_id, follow_up)
   values (${SEAT}, ${USER}, 'handover', 'pass', ${jobId ?? "null"}, ${followUp === null ? "null" : `'${followUp}'`});`;
const cleaning = (jobId: string | null) =>
  `insert into public.cleaning_records (seat_id, employee_id, started_at, technician_job_id)
   values (${SEAT}, ${USER}, '2030-01-01 10:00+00', ${jobId ?? "null"});`;
const installation = (jobId: string) =>
  `insert into public.installations (technician_job_id) values (${jobId});`;

interface Case {
  /** The constraint the violation must be refused by. */
  constraint: string;
  /** Rows just inside the rule: all accepted. */
  inside: string;
  /** The row just outside it: refused. */
  outside: string;
  /** SQLSTATE of the refusal: 23514 check_violation or 23505 unique_violation. */
  code: "23514" | "23505";
}

const CASES: Case[] = [
  { constraint: "airports_code_key", code: "23505", inside: airport("DR1"), outside: airport("DR1") },
  { constraint: "partners_code_key", code: "23505", inside: partner("DR1"), outside: partner("DR1") },
  { constraint: "users_email_key", code: "23505", inside: user("dr1@test.example"), outside: user("dr1@test.example") },
  { constraint: "bookings_booking_number_key", code: "23505", inside: booking("DR-1"), outside: booking("DR-1") },
  {
    constraint: "bookings_paid_days_cap_check",
    code: "23514",
    inside: booking("DR-20", undefined, undefined, 6),
    outside: booking("DR-21", undefined, undefined, 7),
  },
  {
    constraint: "bookings_gross_revenue_check",
    code: "23514",
    inside: `${bookingWith("DR-30", "gross_revenue", "0")} ${bookingWith("DR-31", "gross_revenue", "null")}`,
    outside: bookingWith("DR-32", "gross_revenue", "-0.01"),
  },
  // The shares: each outside row breaks only the rule under test (Postgres checks in name order).
  {
    constraint: "bookings_partner_share_check",
    code: "23514",
    inside: bookingWith("DR-33", "gross_revenue, partner_share, platform_share", "100, 0, 100"),
    outside: bookingWith("DR-34", "gross_revenue, partner_share, platform_share", "100, -1, 101"),
  },
  {
    constraint: "bookings_platform_share_check",
    code: "23514",
    inside: bookingWith("DR-35", "gross_revenue, partner_share, platform_share", "100, 100, 0"),
    outside: bookingWith("DR-36", "gross_revenue, partner_share, platform_share", "100, 101, -1"),
  },
  {
    constraint: "bookings_shares_together_check",
    code: "23514",
    inside: `${bookingWith("DR-37", "gross_revenue, partner_share, platform_share", "10, 5, 5")} ${bookingWith("DR-38", "gross_revenue", "10")}`,
    outside: bookingWith("DR-39", "gross_revenue, partner_share", "10, 5"),
  },
  {
    constraint: "bookings_shares_sum_check",
    code: "23514",
    inside: bookingWith("DR-40", "gross_revenue, partner_share, platform_share", "10, 5, 5"),
    outside: bookingWith("DR-41", "gross_revenue, partner_share, platform_share", "10, 5, 4"),
  },
  // The launch credit (VI-F04-S06); each outside row breaks only the rule under test.
  {
    constraint: "bookings_launch_credit_check",
    code: "23514",
    inside: `${bookingWith("DR-50", "launch_credit", "0")} ${bookingWith("DR-51", "launch_credit, launch_credit_balance", "5, 5")}`,
    outside: bookingWith("DR-52", "launch_credit, launch_credit_balance", "-1, 5"),
  },
  {
    constraint: "bookings_launch_credit_balance_check",
    code: "23514",
    inside: `${bookingWith("DR-53", "launch_credit_balance", "0")} ${bookingWith("DR-54", "launch_credit_balance", "null")}`,
    outside: bookingWith("DR-55", "launch_credit_balance", "-1"),
  },
  {
    constraint: "bookings_launch_credit_together_check",
    code: "23514",
    inside: `${bookingWith("DR-56", "launch_credit, launch_credit_balance", "5, 5")} ${bookingWith("DR-57", "launch_credit", "0")}`,
    outside: bookingWith("DR-58", "launch_credit", "5"),
  },
  // Adjustments (VI-F04-S10).
  {
    constraint: "bookings_adjustments_total_check",
    code: "23514",
    inside: `${bookingWith("DR-70", "adjustments_total", "0")} ${bookingWith("DR-71", "adjustments_total", "-5")}`,
    outside: bookingWith("DR-72", "adjustments_total", "1"),
  },
  {
    constraint: "booking_adjustments_amount_check",
    code: "23514",
    inside: adjustment("0.01", "'A reason'"),
    outside: adjustment("0", "'A reason'"),
  },
  {
    constraint: "booking_adjustments_reason_check",
    code: "23514",
    inside: `${adjustment("1", "'x'")} ${adjustment("1", "repeat('x', 1000)")}`,
    outside: adjustment("1", "'   '"),
  },
  // The financial history (VI-F04-S16).
  {
    constraint: "finance_history_table_check",
    code: "23514",
    inside: financeHistory("invoices", "insert", "'A reason'"),
    outside: financeHistory("bookings", "insert", "'A reason'"),
  },
  {
    constraint: "finance_history_action_check",
    code: "23514",
    inside: financeHistory("invoices", "update", "'A reason'"),
    outside: financeHistory("invoices", "delete", "'A reason'"),
  },
  {
    constraint: "finance_history_reason_check",
    code: "23514",
    inside: `${financeHistory("invoices", "insert", "'x'")} ${financeHistory("invoices", "insert", "repeat('x', 1000)")}`,
    outside: financeHistory("invoices", "insert", "'   '"),
  },
  // Early returns, cancellations and no-shows (VI-F04-S07).
  {
    constraint: "bookings_actual_return_check",
    code: "23514",
    inside: `${bookingWith("DR-60", "actual_return_at", "'2030-01-01 10:00+00'")} ${bookingWith("DR-61", "actual_return_at", "null")}`,
    outside: bookingWith("DR-62", "actual_return_at", "'2030-01-01 09:59+00'"),
  },
  {
    constraint: "bookings_revenue_case_check",
    code: "23514",
    inside: `${bookingWith("DR-63", "revenue_case", "'standard'")} ${bookingWith("DR-64", "revenue_case", "'early_return'")} ${bookingWith("DR-65", "revenue_case", "'cancelled'")} ${bookingWith("DR-66", "revenue_case", "'no_show'")} ${bookingWith("DR-67", "revenue_case", "null")}`,
    outside: bookingWith("DR-68", "revenue_case", "'other'"),
  },
  {
    constraint: "bookings_rental_days_check",
    code: "23514",
    inside: `${bookingWith("DR-22", "rental_days", "0")} ${bookingWith("DR-23", "rental_days", "null")}`,
    outside: bookingWith("DR-24", "rental_days", "-1"),
  },
  {
    constraint: "bookings_revenue_flag_check",
    code: "23514",
    inside: `${bookingWith("DR-25", "revenue_flag", "'invalid_duration'")} ${bookingWith("DR-26", "revenue_flag", "null")} ${bookingWith("DR-28", "revenue_flag", "'no_terms'")}`,
    outside: bookingWith("DR-27", "revenue_flag", "'other'"),
  },
  {
    constraint: "bookings_paid_days_check",
    code: "23514",
    inside: booking("DR-2", undefined, undefined, 0),
    outside: booking("DR-3", undefined, undefined, -1),
  },
  {
    constraint: "bookings_return_after_pickup_check",
    code: "23514",
    inside: booking("DR-4", "2030-01-01 10:00+00", "2030-01-01 10:00+00"),
    outside: booking("DR-5", "2030-01-01 10:00:01+00", "2030-01-01 10:00+00"),
  },
  {
    constraint: "invoices_invoice_number_key",
    code: "23505",
    inside: `insert into public.invoices (partner_id, invoice_number, issue_date, due_date, subtotal, total) values (${PARTNER}, 'DR-INV-1', '2030-01-01', '2030-01-31', 1, 1);`,
    outside: `insert into public.invoices (partner_id, invoice_number, issue_date, due_date, subtotal, total) values (${PARTNER}, 'DR-INV-1', '2030-02-01', '2030-02-28', 1, 1);`,
  },
  {
    constraint: "partner_commercial_terms_annual_fee_check",
    code: "23514",
    inside: termsWith("annual_fee", "0"),
    outside: termsWith("annual_fee", "-0.01"),
  },
  {
    constraint: "partner_commercial_terms_launch_credit_target_check",
    code: "23514",
    inside: `${termsWith("launch_credit_target", "0")} ${termsWith("launch_credit_target", "null")}`,
    outside: termsWith("launch_credit_target", "-0.01"),
  },
  {
    constraint: "partner_commercial_terms_onboarding_fee_check",
    code: "23514",
    inside: termsWith("onboarding_fee", "0"),
    outside: termsWith("onboarding_fee", "-0.01"),
  },
  {
    constraint: "partner_commercial_terms_payment_terms_check",
    code: "23514",
    inside: `${termsWith("payment_terms_days", "0")} ${termsWith("payment_terms_days", "3650")}`,
    outside: termsWith("payment_terms_days", "3651"),
  },
  {
    constraint: "partner_commercial_terms_vat_rate_check",
    code: "23514",
    inside: `${termsWith("vat_rate_percent", "0")} ${termsWith("vat_rate_percent", "100")}`,
    outside: termsWith("vat_rate_percent", "100.01"),
  },
  {
    constraint: "partner_commercial_terms_launch_not_below_partner_check",
    code: "23514",
    inside: terms("50", "50", "50"),
    outside: terms("50", "50", "49.99"),
  },
  {
    constraint: "partner_commercial_terms_launch_share_check",
    code: "23514",
    inside: `${terms("0", "100", "0")} ${terms("100", "0", "100")}`,
    outside: terms("100", "0", "100.01"),
  },
  {
    constraint: "partner_commercial_terms_partner_share_check",
    code: "23514",
    inside: `${terms("0", "100", "0")} ${terms("100", "0", "100")}`,
    outside: terms("-0.01", "100.01", "0"),
  },
  {
    constraint: "partner_commercial_terms_period_check",
    code: "23514",
    inside: terms("30", "70", "50", "'2030-01-01'"),
    outside: terms("30", "70", "50", "'2029-12-31'"),
  },
  {
    constraint: "partner_commercial_terms_platform_share_check",
    code: "23514",
    inside: `${terms("0", "100", "0")} ${terms("100", "0", "100")}`,
    outside: terms("30", "-0.01", "50"),
  },
  {
    constraint: "partner_commercial_terms_shares_sum_check",
    code: "23514",
    inside: terms("30", "70", "50"),
    outside: terms("30", "69.99", "50"),
  },
  {
    constraint: "seat_categories_age_range_check",
    code: "23514",
    inside: `insert into public.seat_categories (name, min_child_age, max_child_age, safety_standard) values ('DR-A', 10, 10, 'S');`,
    outside: `insert into public.seat_categories (name, min_child_age, max_child_age, safety_standard) values ('DR-B', 10, 9, 'S');`,
  },
  { constraint: "seats_max_rental_cycles_check", code: "23514", inside: seat("DR-S1", "dr-t1", 1), outside: seat("DR-S2", "dr-t2", 0) },
  { constraint: "seats_rental_cycles_check", code: "23514", inside: seat("DR-S3", "dr-t3", 10, 0), outside: seat("DR-S4", "dr-t4", 10, -1) },
  { constraint: "seats_serial_number_key", code: "23505", inside: seat("DR-S5", "dr-t5"), outside: seat("DR-S5", "dr-t6") },
  { constraint: "seats_public_token_key", code: "23505", inside: seat("DR-S6", "dr-t7"), outside: seat("DR-S7", "dr-t7") },
  {
    constraint: "settlements_period_check",
    code: "23514",
    inside: `insert into public.settlements (partner_id, period_start, period_end) values (${PARTNER}, '2030-01-01', '2030-01-01');`,
    outside: `insert into public.settlements (partner_id, period_start, period_end) values (${PARTNER}, '2030-01-01', '2029-12-31');`,
  },
  {
    constraint: "settlements_partner_period_unique",
    code: "23505",
    inside: `insert into public.settlements (partner_id, period_start, period_end) values (${PARTNER}, '2031-05-01', '2031-05-31');`,
    outside: `insert into public.settlements (partner_id, period_start, period_end) values (${PARTNER}, '2031-05-01', '2031-05-31');`,
  },
  {
    constraint: "inspection_records_follow_up_check",
    code: "23514",
    inside: `${inspection(null, null)} ${inspection(null, "seat_quarantined")} ${inspection(null, "seat_quarantined_active_booking")}`,
    outside: inspection(null, "seat_released"),
  },
  {
    // A job that is finished does not count: only assigned and in progress are open.
    constraint: "technician_jobs_open_booking_type_uidx",
    code: "23505",
    inside: `${job("installation", "completed")} ${job("installation", "assigned")} ${job("cleaning", "assigned")}`,
    outside: job("installation", "in_progress"),
  },
  {
    constraint: "installations_technician_job_id_uidx",
    code: "23505",
    inside: installation(uuid(11)),
    outside: installation(uuid(11)),
  },
  {
    // Many records with no job are fine: the rule is on a job that is set.
    constraint: "cleaning_records_technician_job_id_uidx",
    code: "23505",
    inside: `${cleaning(null)} ${cleaning(null)} ${cleaning(uuid(12))}`,
    outside: cleaning(uuid(12)),
  },
  {
    constraint: "inspection_records_technician_job_id_uidx",
    code: "23505",
    inside: `${inspection(null)} ${inspection(null)} ${inspection(uuid(13))}`,
    outside: inspection(uuid(13)),
  },
];

const HISTORY_TABLES = ["booking_events", "technician_job_events", "incident_status_history", "booking_adjustments", "finance_history"];

/** SQL with plain output: one value per line, no headers. */
const plain = (sql: string) => `\\set QUIET on\n\\pset tuples_only on\n\\pset format unaligned\n${sql}`;

function column(sql: string): string[] {
  const result = runSql(plain(sql));
  expect(result?.ok, result?.output).toBe(true);
  return result!.output.split("\n").map((line) => line.trim()).filter(Boolean);
}

describe.skipIf(!available)("constraints (VI-F08-S03, spec R3)", () => {
  /** What happened to each case: `CASE|constraint|result|constraint name|sqlstate`. */
  const outcome = new Map<string, { result: string; name: string; code: string }>();

  beforeAll(() => {
    const blocks = CASES.map(
      ({ constraint, inside, outside }) => `
        do $case$
        declare v_name text;
        begin
          begin
            ${inside}
          exception when others then
            raise notice 'CASE|${constraint}|inside_failed|%|%', sqlerrm, sqlstate;
            return;
          end;
          begin
            ${outside}
            raise notice 'CASE|${constraint}|not_refused||';
          exception when others then
            get stacked diagnostics v_name = constraint_name;
            raise notice 'CASE|${constraint}|refused|%|%', coalesce(v_name, sqlerrm), sqlstate;
          end;
        end
        $case$;`,
    );
    const result = runSql(
      `begin;\nset local session_replication_role = replica;\n${blocks.join("\n")}\nrollback;\n`,
    );
    expect(result?.ok, result?.output).toBe(true);

    for (const line of result!.output.split("\n")) {
      const match = /CASE\|([^|]+)\|([^|]+)\|([^|]*)\|(\w*)/.exec(line);
      if (match) outcome.set(match[1], { result: match[2], name: match[3], code: match[4] });
    }
  }, 60_000);

  it.each(CASES.map((c) => [c.constraint, c] as const))(
    "should accept a row just inside %s and refuse the row just outside it",
    (name, c) => {
      expect(outcome.get(name), `no outcome for ${name}`).toBeDefined();
      expect(outcome.get(name)).toEqual({ result: "refused", name, code: c.code });
    },
  );

  it("should have a case for every CHECK, UNIQUE and standalone unique index of the schema, and no case for a rule that is gone", () => {
    const constraints = column(`
      select conname from pg_constraint
       where connamespace = 'public'::regnamespace and contype in ('c', 'u')
      union all
      select indexname from pg_indexes
       where schemaname = 'public' and indexdef ilike 'create unique index%'
         and indexname not in (select conname from pg_constraint where connamespace = 'public'::regnamespace);`);
    const gaps = findDataRuleGaps({
      constraints,
      casedConstraints: CASES.map((c) => c.constraint),
      statusFunctions: [],
      historyTables: [],
      casedHistoryTables: [],
      tests: [],
    });

    expect(constraints.length).toBeGreaterThanOrEqual(20);
    expect(gaps.map((gap) => gap.message)).toEqual([]);
  });
});

describe.skipIf(!available)("history and business rules (VI-F08-S03, spec R3)", () => {
  it.each(HISTORY_TABLES)(
    "should refuse to update or delete a row of %s, even for the database owner",
    (table) => {
      const result = runSql(`
        begin;
        do $hist$
        declare v_id uuid; v_state text;
        begin
          select id into v_id from public.${table} limit 1;
          if v_id is null then
            raise notice 'HIST|${table}|no_row';
            return;
          end if;
          begin
            update public.${table} set id = id where id = v_id;
            raise notice 'HIST|${table}|update|not_refused';
          exception when sqlstate '55000' then
            raise notice 'HIST|${table}|update|refused';
          end;
          begin
            delete from public.${table} where id = v_id;
            raise notice 'HIST|${table}|delete|not_refused';
          exception when sqlstate '55000' then
            raise notice 'HIST|${table}|delete|refused';
          end;
        end
        $hist$;
        rollback;
      `);

      expect(result?.ok, result?.output).toBe(true);
      expect(result!.output).not.toContain(`HIST|${table}|no_row`);
      expect(result!.output).toContain(`HIST|${table}|update|refused`);
      expect(result!.output).toContain(`HIST|${table}|delete|refused`);
    },
  );

  it("should also refuse TRUNCATE of the history tables, by a trigger on each", () => {
    const withTruncateTrigger = column(`
      select distinct c.relname from pg_trigger t join pg_class c on c.oid = t.tgrelid
       where not t.tgisinternal and t.tgname like 'prevent\\_%\\_truncate' and c.relnamespace = 'public'::regnamespace;`);

    expect(withTruncateTrigger.sort()).toEqual([...HISTORY_TABLES].sort());
  });

  it("should have a test of a refused transition for every change_*_status function, and a case for every history table", () => {
    const statusFunctions = column(
      `select proname from pg_proc where pronamespace = 'public'::regnamespace and proname like 'change\\_%';`,
    );
    const historyTables = column(`
      select distinct c.relname from pg_trigger t join pg_class c on c.oid = t.tgrelid
       where not t.tgisinternal and t.tgname like 'prevent\\_%\\_update' and c.relnamespace = 'public'::regnamespace;`);
    const src = join(process.cwd(), "src");
    const tests = (readdirSync(src, { recursive: true }) as string[])
      .filter((file) => file.endsWith(".test.ts"))
      .map((file) => ({ file, text: readFileSync(join(src, file), "utf8") }));

    const gaps = findDataRuleGaps({
      constraints: [],
      casedConstraints: [],
      statusFunctions,
      historyTables,
      casedHistoryTables: HISTORY_TABLES,
      tests,
    });

    expect(statusFunctions.length).toBeGreaterThanOrEqual(4);
    expect(historyTables.length).toBeGreaterThanOrEqual(3);
    expect(gaps.map((gap) => gap.message)).toEqual([]);
  });
});
