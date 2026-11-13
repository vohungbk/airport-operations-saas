import { describe, expect, it } from "vitest";

import { AIRPORT, CATEGORY, PARTNER, USER, available, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F11-S12 (AC01, AC04): the counts the Partner Overview adds (the upcoming bookings and the resolved
 * incidents of the month) are read as the signed-in user, so RLS must give a partner user only the rows of its
 * own partner. Every scenario runs in a transaction that is rolled back and makes its own rows, in a period of
 * 2033 that holds no demo data. Skipped when the local stack is not running.
 */
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";

const bookingId = (n: number) => `db900000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const incidentId = (n: number) => `db910000-0000-0000-0000-${String(n).padStart(12, "0")}`;

const booking = (n: number, partner: string) => `
  insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate)
  values ('${bookingId(n)}', 'PO-${n}', '${partner}', '${AIRPORT}', '2033-01-05 10:00:00+00', '2033-01-10 10:00:00+00', '${CATEGORY}', 90);`;

const resolvedIncident = (n: number, partner: string) => `
  insert into public.incidents (id, partner_id, type, severity, status, description, reported_by, resolved_at)
  values ('${incidentId(n)}', '${partner}', 'damage', 'low', 'resolved', 'test', ${USER("admin")}::uuid, '2033-01-12 10:00:00+00');`;

const partnerUserOf = (partner: string) =>
  `(select id::text from public.users u where u.role = 'partner_user' and u.is_active and u.partner_id = '${partner}' order by u.email limit 1)`;

/** The two counts of the overview for the window of 2033, read by this partner user. */
const readAs = (label: string, partner: string) => `
  set local role authenticated;
  select set_config('request.jwt.claim.sub', coalesce(${partnerUserOf(partner)}, ''), true);
  do $$ declare upcoming bigint; resolved bigint; begin
    select count(*) into upcoming from public.bookings
     where pickup_at >= '2033-01-01 00:00:00+00' and pickup_at < '2033-02-01 00:00:00+00';
    select count(*) into resolved from public.incidents
     where resolved_at >= '2033-01-01 00:00:00+00' and resolved_at < '2033-02-01 00:00:00+00';
    raise notice 'R|${label}|%|%', upcoming, resolved;
  end $$;
  reset role;`;

const counts = (rows: string[][], label: string) => {
  const row = rows.find((r) => r[0] === label);

  return row ? { upcoming: Number(row[1]), resolved: Number(row[2]) } : undefined;
};

describe.skipIf(!available)("partner overview scope (VI-F11-S12, AC01, AC04)", () => {
  it("should count only the bookings and resolved incidents of the partner of the signed-in user", () => {
    const rows = run(`
      ${booking(1, PARTNER)}${booking(2, PARTNER)}${booking(3, OTHER_PARTNER)}
      ${resolvedIncident(1, PARTNER)}${resolvedIncident(2, OTHER_PARTNER)}${resolvedIncident(3, OTHER_PARTNER)}
      ${readAs("owner", PARTNER)}
      ${readAs("other", OTHER_PARTNER)}`);

    expect(counts(rows, "owner")).toEqual({ upcoming: 2, resolved: 1 });
    expect(counts(rows, "other")).toEqual({ upcoming: 1, resolved: 2 });
  });

  it("should reveal nothing of another partner to a partner user who has no rows of its own", () => {
    const rows = run(`
      ${booking(1, PARTNER)}${resolvedIncident(1, PARTNER)}
      ${readAs("other", OTHER_PARTNER)}`);

    expect(counts(rows, "other")).toEqual({ upcoming: 0, resolved: 0 });
  });
});
