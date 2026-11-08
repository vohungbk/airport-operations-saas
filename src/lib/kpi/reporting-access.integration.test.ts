import { describe, expect, it } from "vitest";

import { AIRPORT, CATEGORY, FLAG_ON, PARTNER, USER, available, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F05-S11: who may read the reporting figures. Every KPI function counts only the rows of the
 * partner of a partner user, the internal roles count every partner, and the other callers count
 * nothing. The baseline inputs have the same proof in baseline-inputs.integration.test.ts. Every
 * scenario runs in a transaction that is rolled back and makes its own bookings, in a period of 2033
 * that holds no demo data. Skipped when the local stack is not running.
 */
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";

const FROM = "2033-01-01 00:00:00+00";
const TO = "2033-02-01 00:00:00+00";

const bookingId = (n: number) => `da900000-0000-0000-0000-${String(n).padStart(12, "0")}`;

/** A completed booking of the partner, returned inside the period. */
const booking = (n: number, partner: string) => `
  insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate)
  values ('${bookingId(n)}', 'RA-${n}', '${partner}', '${AIRPORT}', '2033-01-05 10:00:00+00', '2033-01-10 10:00:00+00', '${CATEGORY}', 90);
  ${FLAG_ON} update public.bookings set status = 'completed' where id = '${bookingId(n)}';`;

/** The KPI functions of a period that report the completed bookings the caller may read. */
const REPORTING_FUNCTIONS = [
  "kpi_correct_seat_figures",
  "kpi_traceability_figures",
  "kpi_incident_figures",
  "kpi_commercial_figures",
  "kpi_additional_figures",
];

/** Reports, for the caller, the completed bookings each function counts. */
const readAll = (label: string) =>
  REPORTING_FUNCTIONS.map(
    (fn) => `
    do $$ declare n bigint; begin
      select completed_bookings into n from public.${fn}('${FROM}', '${TO}');
      raise notice 'R|${label}|${fn}|%', n;
    end $$;`,
  ).join("\n");

/** The next reads are made by this user; `null` is a signed-in id that belongs to nobody. */
const asCaller = (label: string, user: string | null) => `
  set local role authenticated;
  select set_config('request.jwt.claim.sub', ${user === null ? "'00000000-0000-0000-0000-000000000000'" : `coalesce(${user}, '')`}, true);
  ${readAll(label)}
  reset role;`;

const partnerUserOf = (partner: string) =>
  `(select id::text from public.users u where u.role = 'partner_user' and u.is_active and u.partner_id = '${partner}' order by u.email limit 1)`;

const counts = (rows: string[][], label: string) =>
  Object.fromEntries(rows.filter((row) => row[0] === label).map((row) => [row[1], Number(row[2])]));

const everyFunction = (value: number) => Object.fromEntries(REPORTING_FUNCTIONS.map((fn) => [fn, value]));

describe.skipIf(!available)("who may read the reporting figures (VI-F05-S11, AC01, AC02)", () => {
  const callers = `
    ${asCaller("owner", partnerUserOf(PARTNER))}
    ${asCaller("other", partnerUserOf(OTHER_PARTNER))}
    ${asCaller("admin", USER("admin"))}
    ${asCaller("ops", USER("operations_manager"))}
    ${asCaller("technician", USER("technician"))}
    ${asCaller("nobody", null)}`;

  it.each(REPORTING_FUNCTIONS)(
    "should give %s to a partner user for its own bookings only and to the internal roles for every partner",
    (fn) => {
      const rows = run(`
        ${booking(1, PARTNER)}${booking(2, PARTNER)}${booking(3, OTHER_PARTNER)}
        ${callers}`);

      expect(counts(rows, "owner")[fn]).toBe(2);
      expect(counts(rows, "other")[fn]).toBe(1);
      expect(counts(rows, "admin")[fn]).toBe(3);
      expect(counts(rows, "ops")[fn]).toBe(3);
    },
  );

  it("should reveal nothing of another partner to a partner user who has no bookings of its own (AC02)", () => {
    const rows = run(`
      ${booking(1, PARTNER)}${booking(2, PARTNER)}
      ${callers}`);

    expect(counts(rows, "other")).toEqual(everyFunction(0));
    expect(counts(rows, "owner")).toEqual(everyFunction(2));
  });

  it("should count nothing for a technician and for a caller who has no profile", () => {
    const rows = run(`
      ${booking(1, PARTNER)}
      ${callers}`);

    expect(counts(rows, "technician")).toEqual(everyFunction(0));
    expect(counts(rows, "nobody")).toEqual(everyFunction(0));
  });
});
