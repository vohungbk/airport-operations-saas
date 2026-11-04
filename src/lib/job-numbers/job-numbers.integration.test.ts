import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runSqlAsync } from "@/lib/db-test-support";
import {
  AIRPORT,
  CATEGORY,
  PARTNER,
  USER,
  available,
  bookingId,
  newPartner,
  partnerId,
  run,
} from "@/lib/finance/finance-test-support";

/**
 * VI-F11-T01: every job has its own number, made by the database. Every scenario runs in a transaction
 * that is rolled back and makes its own partners, bookings and jobs. The signed-in user is set with
 * `request.jwt.claim.sub`, as in the other database suites. Skipped when the local stack is not running.
 */
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";
const NUMBER = "^JOB-[0-9]{4}-[0-9]{6}$";

const TECH = USER("technician");

const pad = (n: number) => String(n).padStart(12, "0");
const jobId = (n: number) => `d9500000-0000-0000-0000-${pad(n)}`;

/** A booking of its own partner (or of the partner given). */
const booking = (n: number, partner?: string) => `
  ${partner ? "" : newPartner(n)}
  insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate, assigned_technician_id)
  values ('${bookingId(n)}', 'JN-${n}', '${partner ?? partnerId(n)}', '${AIRPORT}', '2030-01-10 12:00:00+00', '2030-01-13 12:00:00+00', '${CATEGORY}', 90, ${TECH}::uuid);`;

const job = (n: number, bookingN: number, extra = "") => `
  insert into public.technician_jobs (id, booking_id, technician_id, job_type${extra ? ", created_at" : ""})
  values ('${jobId(n)}', '${bookingId(bookingN)}', ${TECH}::uuid, 'installation'${extra ? `, ${extra}` : ""});`;

const numberOf = (name: string, n: number) => `
  do $$ begin
    raise notice 'R|${name}|%', coalesce((select job_number from public.technician_jobs where id = '${jobId(n)}'), 'none');
  end $$;`;

/** Reports `R|name|ok` or `R|name|<sqlstate>` for a statement. */
const attempt = (name: string, statement: string) => `
  do $$ begin
    ${statement}
    raise notice 'R|${name}|ok';
  exception when others then
    raise notice 'R|${name}|%', sqlstate;
  end $$;`;

const asRpc = (signal: string, statement: string) => `
  select set_config('${signal}', 'on', true);
  ${statement}
  select set_config('${signal}', '', true);`;

const result = (rows: string[][], name: string) => rows.find((row) => row[0] === name)?.slice(1).join("|");
const counter = (value: string | undefined) => Number(value?.slice(-6));

describe.skipIf(!available)("job number (VI-F11-T01, AC01, AC03, AC06)", () => {
  it("should give each new job the next number in the form JOB-YYYY-NNNNNN with the year of its creation", () => {
    const rows = run(`
      ${booking(1)}
      ${booking(2)}
      ${booking(3)}
      ${job(1, 1)}
      ${job(2, 2)}
      ${job(3, 3)}
      ${numberOf("first", 1)}
      ${numberOf("second", 2)}
      ${numberOf("third", 3)}
      do $$ begin
        raise notice 'R|shape|%|%',
          (select count(*) from public.technician_jobs where id in ('${jobId(1)}', '${jobId(2)}', '${jobId(3)}') and job_number ~ '${NUMBER}'),
          (select count(*) from public.technician_jobs where id = '${jobId(1)}'
              and job_number like 'JOB-' || to_char(created_at at time zone 'UTC', 'YYYY') || '-%');
      end $$;`);

    expect(result(rows, "shape")).toBe("3|1");
    expect(counter(result(rows, "second"))).toBeGreaterThan(counter(result(rows, "first")));
    expect(counter(result(rows, "third"))).toBeGreaterThan(counter(result(rows, "second")));
  });

  it("should use the year of the insert even when created_at is sent, and never hand a number out again after a rollback", () => {
    const rows = run(`
      ${booking(1)}
      ${booking(2)}
      ${job(1, 1, "timestamptz '2025-06-01 10:00:00+00'")}
      ${numberOf("old", 1)}
      savepoint before_job;
      ${job(2, 2)}
      select set_config('t.rolled_back', (select job_number from public.technician_jobs where id = '${jobId(2)}'), true);
      rollback to savepoint before_job;
      ${job(2, 2)}
      do $$ begin
        raise notice 'R|reused|%', (select job_number from public.technician_jobs where id = '${jobId(2)}') = current_setting('t.rolled_back');
      end $$;`);

    expect(result(rows, "old")).toMatch(new RegExp(`^JOB-${new Date().getUTCFullYear()}-[0-9]{6}$`));
    expect(result(rows, "reused")).toBe("false");
  });

  it("should keep the number when the job is edited or its status changes", () => {
    const rows = run(`
      ${booking(1)}
      ${job(1, 1)}
      ${numberOf("before", 1)}
      update public.technician_jobs set vehicle_bay = 'Bay 9', installation_notes = 'Edited' where id = '${jobId(1)}';
      ${numberOf("edited", 1)}
      ${asRpc("app.job_status_change", `update public.technician_jobs set status = 'in_progress', started_at = now() where id = '${jobId(1)}';`)}
      ${numberOf("started", 1)}
      ${asRpc("app.job_status_change", `update public.technician_jobs set status = 'completed', completed_at = now() where id = '${jobId(1)}';`)}
      ${numberOf("completed", 1)}`);

    expect(result(rows, "before")).toMatch(new RegExp(NUMBER));
    for (const name of ["edited", "started", "completed"]) {
      expect(result(rows, name), name).toBe(result(rows, "before"));
    }
  });

  it("should refuse a job number sent on insert or changed on update, whoever sends it", () => {
    const rows = run(`
      ${booking(1)}
      ${booking(2)}
      ${job(1, 1)}
      ${numberOf("before", 1)}
      ${attempt("owner-insert", `insert into public.technician_jobs (booking_id, technician_id, job_type, job_number) values ('${bookingId(2)}', ${TECH}::uuid, 'installation', 'JOB-2026-999999');`)}
      ${attempt("owner-update", `update public.technician_jobs set job_number = 'JOB-2026-999999' where id = '${jobId(1)}';`)}
      select set_config('request.jwt.claim.sub', coalesce(${USER("operations_manager")}, ''), true);
      set local role authenticated;
      ${attempt("ops-insert", `insert into public.technician_jobs (booking_id, technician_id, job_type, job_number) values ('${bookingId(2)}', ${TECH}::uuid, 'installation', 'JOB-2026-999999');`)}
      ${attempt("ops-update", `update public.technician_jobs set job_number = 'JOB-2026-999999' where id = '${jobId(1)}';`)}
      ${attempt("ops-insert-without-number", `insert into public.technician_jobs (id, booking_id, technician_id, job_type) values ('${jobId(2)}', '${bookingId(2)}', ${TECH}::uuid, 'installation');`)}
      reset role;
      ${numberOf("after", 1)}
      ${numberOf("created-by-ops", 2)}`);

    for (const name of ["owner-insert", "owner-update", "ops-insert", "ops-update"]) {
      expect(result(rows, name), name).toBe("55000");
    }
    expect(result(rows, "ops-insert-without-number")).toBe("ok");
    expect(result(rows, "after")).toBe(result(rows, "before"));
    expect(result(rows, "created-by-ops")).toMatch(new RegExp(NUMBER));
  });
});

describe.skipIf(!available)("job numbers of jobs that exist before the change (VI-F11-T01, AC04)", () => {
  /** The backfill of the migration, taken from the file so the test cannot drift from it. */
  const backfill = /do \$\$[\s\S]*?\$\$;/.exec(
    readFileSync(join(process.cwd(), "supabase", "migrations", "20261128090000_job_number.sql"), "utf8"),
  )?.[0];

  it("should give every existing job a unique number in the order the jobs were made", () => {
    expect(backfill).toBeDefined();

    const rows = run(`
      ${booking(1)}
      ${booking(2)}
      ${booking(3)}
      ${job(1, 1, "timestamptz '2024-03-01 10:00:00+00'")}
      ${job(2, 2, "timestamptz '2024-01-01 10:00:00+00'")}
      ${job(3, 3, "timestamptz '2025-02-01 10:00:00+00'")}
      -- The state before the migration: no number at all.
      alter table public.technician_jobs disable trigger guard_technician_jobs_job_number;
      alter table public.technician_jobs alter column job_number drop not null;
      update public.technician_jobs set job_number = null;
      ${backfill}
      do $$ begin
        raise notice 'R|all|%|%|%',
          (select count(*) from public.technician_jobs where job_number is null),
          (select count(*) - count(distinct job_number) from public.technician_jobs),
          (select count(*) from public.technician_jobs where job_number !~ '${NUMBER}');
        raise notice 'R|order|%', (
          select count(*) from (
            select substr(job_number, 10)::int as n,
                   lag(substr(job_number, 10)::int) over (order by created_at, id) as previous
              from public.technician_jobs
          ) x where x.previous is not null and x.n <= x.previous);
      end $$;
      ${numberOf("oldest", 2)}
      ${numberOf("year-2025", 3)}`);

    expect(result(rows, "all")).toBe("0|0|0");
    expect(result(rows, "order")).toBe("0");
    expect(result(rows, "oldest")).toMatch(/^JOB-2024-[0-9]{6}$/);
    expect(result(rows, "year-2025")).toMatch(/^JOB-2025-[0-9]{6}$/);
  });

  it("should have no job without a number or with a number that another job has", () => {
    const rows = run(`
      do $$ begin
        raise notice 'R|jobs|%|%|%',
          (select count(*) from public.technician_jobs where job_number is null),
          (select count(*) - count(distinct job_number) from public.technician_jobs),
          (select count(*) from public.technician_jobs where job_number !~ '${NUMBER}');
      end $$;`);

    expect(result(rows, "jobs")).toBe("0|0|0");
  });
});

describe.skipIf(!available)("two jobs made at the same time (VI-F11-T01, AC02)", () => {
  /** One session: its own transaction that makes `count` jobs, waits so the other session overlaps, then rolls back. */
  const session = (first: number, count: number) => `
    begin;
    ${Array.from({ length: count }, (_, i) => `${booking(first + i)}\n${job(first + i, first + i)}`).join("\n")}
    do $$ begin
      raise notice 'R|numbers|%', (select string_agg(job_number, ',') from public.technician_jobs where id::text like 'd9500000-%');
    end $$;
    select pg_sleep(2);
    rollback;`;

  const numbersOf = (output: string) =>
    (/R\|numbers\|([^\n]*)/.exec(output)?.[1] ?? "").split(",").filter(Boolean);

  it("should give different numbers to jobs made by two sessions at once", async () => {
    const [first, second] = await Promise.all([runSqlAsync(session(500, 10)), runSqlAsync(session(600, 10))]);

    expect(first?.ok, first?.output).toBe(true);
    expect(second?.ok, second?.output).toBe(true);

    const all = [...numbersOf(first!.output), ...numbersOf(second!.output)];

    expect(all).toHaveLength(20);
    expect(new Set(all).size).toBe(20);
  });
});

describe.skipIf(!available)("who can read the job number (VI-F11-T01, cross-tenant denial)", () => {
  const USER_OF = (name: string, role: string, partner: string | null) => `
    select set_config('t.${name}', coalesce(
      (select id::text from public.users u where u.role = '${role}' and u.is_active
         ${partner ? `and u.partner_id = '${partner}'` : ""} order by u.email limit 1), ''), true);`;

  const readAs = (name: string, key: string) => `
    select set_config('request.jwt.claim.sub', current_setting('t.${key}'), true);
    do $$ begin
      raise notice 'R|${name}|%', coalesce((select string_agg(job_number, ',') from public.technician_jobs where id = '${jobId(1)}'), 'none');
    end $$;`;

  const rows = available
    ? run(`
        ${USER_OF("ops", "operations_manager", null)}
        ${USER_OF("owner", "partner_user", PARTNER)}
        ${USER_OF("other", "partner_user", OTHER_PARTNER)}
        do $$ begin
          raise notice 'R|have|%|%|%', current_setting('t.ops') <> '', current_setting('t.owner') <> '', current_setting('t.other') <> '';
        end $$;
        ${booking(1, PARTNER)}
        ${job(1, 1)}
        set local role authenticated;
        ${readAs("ops", "ops")}
        ${readAs("owner", "owner")}
        ${readAs("other", "other")}`)
    : [];

  it("should have an operations manager and a partner user for each of the two partners", () => {
    expect(result(rows, "have")).toBe("true|true|true");
  });

  it("should show the number to an operations manager and to the partner user of the booking", () => {
    expect(result(rows, "ops")).toMatch(new RegExp(NUMBER));
    expect(result(rows, "owner")).toBe(result(rows, "ops"));
  });

  it("should show a partner user of another partner nothing", () => {
    expect(result(rows, "other")).toBe("none");
  });
});
