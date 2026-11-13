import { describe, expect, it } from "vitest";

import { AIRPORT, CATEGORY, PARTNER, USER, available, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F11-T02: a technician reads the display name of the partner of a job assigned to them and nothing more.
 * Every scenario runs in a transaction that is rolled back and makes its own bookings and jobs. Skipped when
 * the local stack is not running.
 */
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";

const BOOKING_OWN = "dc000000-0000-0000-0000-000000000001";
const BOOKING_OTHER = "dc000000-0000-0000-0000-000000000002";
const JOB_OWN = "dc100000-0000-0000-0000-000000000001";
const JOB_OTHER = "dc100000-0000-0000-0000-000000000002";

const booking = (id: string, partner: string) => `
  insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate)
  values ('${id}', 'TP-${id.slice(-2)}', '${partner}', '${AIRPORT}', '2033-01-05 10:00:00+00', '2033-01-10 10:00:00+00', '${CATEGORY}', 90);`;

const job = (id: string, bookingId: string, technician: string) => `
  insert into public.technician_jobs (id, booking_id, technician_id, job_type, status)
  values ('${id}', '${bookingId}', ${technician}::uuid, 'installation', 'assigned');`;

/** Two jobs: the first is assigned to technician 1 (partner 1), the second to technician 2 (partner 2). */
const SETUP = `
  ${booking(BOOKING_OWN, PARTNER)}${booking(BOOKING_OTHER, OTHER_PARTNER)}
  ${job(JOB_OWN, BOOKING_OWN, USER("technician"))}${job(JOB_OTHER, BOOKING_OTHER, USER("technician", 1))}
  do $$ begin
    raise notice 'R|name|%', (select name from public.partners where id = '${PARTNER}');
  end $$;`;

const IDS = `array['${JOB_OWN}'::uuid, '${JOB_OTHER}'::uuid]`;

/** The next reads are made by this user. */
const asCaller = (user: string, reads: string) => `
  set local role authenticated;
  select set_config('request.jwt.claim.sub', coalesce(${user}, ''), true);
  ${reads}
  reset role;`;

const names = (label: string) => `
  do $$ declare r record; begin
    for r in select * from public.technician_job_partner_names(${IDS}) order by job_id loop
      raise notice 'R|${label}|%|%', r.job_id, r.partner_name;
    end loop;
    raise notice 'R|${label}|end';
  end $$;`;

const rowsOf = (rows: string[][], label: string) => rows.filter((row) => row[0] === label && row[1] !== "end");

describe.skipIf(!available)("technician job partner names (VI-F11-T02)", () => {
  it("should give a technician the partner name of their own job and of no other job (AC01, AC02)", () => {
    const rows = run(`${SETUP} ${asCaller(USER("technician"), names("tech1"))}`);
    const partnerName = rows.find((row) => row[0] === "name")![1];

    expect(rowsOf(rows, "tech1")).toEqual([["tech1", JOB_OWN, partnerName]]);
  });

  it("should give a technician with no assigned job, and a role that is not a technician, no name (AC05)", () => {
    const rows = run(`
      ${SETUP}
      ${asCaller(USER("technician", 2), names("idle"))}
      ${asCaller(USER("admin"), names("admin"))}
      ${asCaller("null", names("nobody"))}`);

    expect(rowsOf(rows, "idle")).toEqual([]);
    expect(rowsOf(rows, "admin")).toEqual([]);
    expect(rowsOf(rows, "nobody")).toEqual([]);
  });

  it("should give a technician no row when they read the partners table directly (AC03)", () => {
    const rows = run(`
      ${SETUP}
      ${asCaller(
        USER("technician"),
        `do $$ begin raise notice 'R|direct|%', (select count(*) from public.partners); end $$;`,
      )}`);

    expect(rows.find((row) => row[0] === "direct")![1]).toBe("0");
  });

  it("should not offer a column other than the job and the display name (AC04)", () => {
    const rows = run(`
      ${SETUP}
      ${asCaller(
        USER("technician"),
        `do $$ begin
           execute 'select partner_id from public.technician_job_partner_names(${IDS.replaceAll("'", "''")})';
           raise notice 'R|column|offered';
         exception when undefined_column then
           raise notice 'R|column|not available';
         end $$;`,
      )}`);

    expect(rows.find((row) => row[0] === "column")![1]).toBe("not available");
  });
});
