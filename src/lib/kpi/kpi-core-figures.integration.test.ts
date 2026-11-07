import { describe, expect, it } from "vitest";

import { AIRPORT, CATEGORY, FLAG_ON, PARTNER, USER, available, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F05-S01: the three core KPI functions (traceability, incidents, commercial performance) count the
 * right rows and only the rows the caller may read. Every scenario runs in a transaction that is rolled
 * back and makes its own bookings, seats, records and incidents, in a period of 2031 that holds no demo
 * data. Skipped when the local stack is not running.
 */
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";
const TECH = USER("technician");

const FROM = "2031-01-01 00:00:00+00";
const TO = "2031-02-01 00:00:00+00";
const PICKUP = "2031-01-05 10:00:00+00";
const RETURN = "2031-01-10 10:00:00+00";

const pad = (n: number) => String(n).padStart(12, "0");
const bookingId = (n: number) => `da500000-0000-0000-0000-${pad(n)}`;
const seatId = (n: number) => `da700000-0000-0000-0000-${pad(n)}`;

const seat = (n: number) => `
  insert into public.seats (id, serial_number, manufacturer, model, category_id, airport_id, manufacture_date, purchase_date, max_rental_cycles)
  values ('${seatId(n)}', 'KC-SEAT-${n}', 'Test', 'Test', '${CATEGORY}', '${AIRPORT}', date '2029-01-01', date '2029-01-01', 100);`;

interface BookingOptions {
  partner?: string;
  status?: string;
  ret?: string;
  seat?: boolean;
}

/** A booking in the period, in the status asked for (completed by default), with its own seat when asked. */
const booking = (n: number, o: BookingOptions = {}) => `
  ${o.seat ? seat(n) : ""}
  insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate, assigned_seat_id)
  values ('${bookingId(n)}', 'KC-${n}', '${o.partner ?? PARTNER}', '${AIRPORT}', '${PICKUP}', '${o.ret ?? RETURN}', '${CATEGORY}', 90, ${o.seat ? `'${seatId(n)}'` : "null"});
  ${FLAG_ON} update public.bookings set status = '${o.status ?? "completed"}' where id = '${bookingId(n)}';`;

const cleaning = (n: number) => `
  insert into public.cleaning_records (seat_id, booking_id, employee_id, started_at, completed_at)
  values ('${seatId(n)}', '${bookingId(n)}', ${TECH}::uuid, now(), now());`;

const inspection = (n: number) => `
  insert into public.inspection_records (seat_id, booking_id, inspector_id, inspection_type, result)
  values ('${seatId(n)}', '${bookingId(n)}', ${TECH}::uuid, 'general', 'pass');`;

const incident = (n: number) => `
  insert into public.incidents (partner_id, booking_id, type, severity, description, reported_by)
  values ('${PARTNER}', '${bookingId(n)}', 'installation', 'low', 'KPI test', ${TECH}::uuid);`;

const traceability = (name: string) => `
  do $$ declare r record; begin
    select * into r from public.kpi_traceability_figures('${FROM}', '${TO}');
    raise notice 'R|${name}|%|%', r.completed_bookings, r.traced_bookings;
  end $$;`;

const incidents = (name: string) => `
  do $$ declare r record; begin
    select * into r from public.kpi_incident_figures('${FROM}', '${TO}');
    raise notice 'R|${name}|%|%', r.completed_bookings, r.incidents;
  end $$;`;

const commercial = (name: string) => `
  do $$ declare r record; begin
    select * into r from public.kpi_commercial_figures('${FROM}', '${TO}');
    raise notice 'R|${name}|%|%|%', r.completed_bookings, r.with_revenue, r.partner_revenue;
  end $$;`;

const numbers = (rows: string[][], name: string) => rows.find((row) => row[0] === name)?.slice(1).map(Number) ?? [];

describe.skipIf(!available)("cleaning / inspection traceability (VI-F05-S01, AC03)", () => {
  it("should count the completed bookings that have both a cleaning record and an inspection record", () => {
    const rows = run(`
      ${booking(1, { seat: true })}${cleaning(1)}${inspection(1)}
      ${booking(2, { seat: true })}${cleaning(2)}
      ${booking(3, { seat: true })}
      ${booking(4, { seat: true, status: "in_progress" })}${cleaning(4)}${inspection(4)}
      ${booking(5, { seat: true, ret: "2031-03-10 10:00:00+00" })}${cleaning(5)}${inspection(5)}
      ${traceability("figures")}`);

    // Bookings 1 to 3 are completed in the period; only 1 has both records. 4 is still active, 5 is outside the period.
    expect(numbers(rows, "figures")).toEqual([3, 1]);
  });
});

describe.skipIf(!available)("operational incidents (VI-F05-S01, AC03)", () => {
  it("should count the incidents of the completed bookings in the period, and the bookings", () => {
    const rows = run(`
      ${booking(1)}${incident(1)}${incident(1)}
      ${booking(2)}${incident(2)}
      ${booking(3, { status: "in_progress" })}${incident(3)}
      ${booking(4, { ret: "2031-03-10 10:00:00+00" })}${incident(4)}
      ${incidents("figures")}`);

    expect(numbers(rows, "figures")).toEqual([2, 3]);
  });

  it("should count no incident for a completed booking that has none", () => {
    const rows = run(`${booking(1)}${incidents("figures")}`);

    expect(numbers(rows, "figures")).toEqual([1, 0]);
  });
});

describe.skipIf(!available)("commercial performance (VI-F05-S01, AC03)", () => {
  it("should sum the partner share of the completed bookings and leave out a share that is not calculated", () => {
    const rows = run(`
      ${booking(1)}
      ${booking(2, { status: "returned" })}
      ${commercial("figures")}
      do $$ begin
        raise notice 'R|expected|%', coalesce((select sum(partner_share) from public.bookings where id in ('${bookingId(1)}', '${bookingId(2)}')), 0);
      end $$;`);

    const [completed, withRevenue, revenue] = numbers(rows, "figures");

    expect(completed).toBe(2);
    // The booking that is only returned has no share yet, so it is counted but not summed.
    expect(withRevenue).toBe(1);
    expect(revenue).toBeGreaterThan(0);
    expect(revenue).toBe(numbers(rows, "expected")[0]);
  });
});

describe.skipIf(!available)("who is counted (VI-F05-S01, AC03, E5)", () => {
  const userOf = (name: string, partner: string) => `
    select set_config('t.${name}', coalesce(
      (select id::text from public.users u where u.role = 'partner_user' and u.is_active and u.partner_id = '${partner}' order by u.email limit 1), ''), true);`;

  const asPartnerUser = (name: string) => `
    set local role authenticated;
    select set_config('request.jwt.claim.sub', current_setting('t.${name}'), true);
    ${traceability(`traceability-${name}`)}
    ${incidents(`incidents-${name}`)}
    ${commercial(`commercial-${name}`)}
    reset role;`;

  it("should count only the rows of the partner of a partner user, never the rows of another partner (cross-tenant denial)", () => {
    const rows = run(`
      ${userOf("owner", PARTNER)}
      ${userOf("other", OTHER_PARTNER)}
      do $$ begin
        raise notice 'R|have|%|%', current_setting('t.owner') <> '', current_setting('t.other') <> '';
      end $$;
      ${booking(1, { seat: true, partner: PARTNER })}${cleaning(1)}${inspection(1)}
      ${booking(2, { seat: true, partner: OTHER_PARTNER })}
      ${booking(3, { seat: true, partner: OTHER_PARTNER })}
      ${traceability("traceability-everyone")}
      ${asPartnerUser("owner")}
      ${asPartnerUser("other")}`);

    expect(rows.find((row) => row[0] === "have")?.slice(1)).toEqual(["t", "t"]);
    expect(numbers(rows, "traceability-everyone")).toEqual([3, 1]);
    expect(numbers(rows, "traceability-owner")).toEqual([1, 1]);
    expect(numbers(rows, "traceability-other")).toEqual([2, 0]);
    // The other partner's bookings never show in the figures of the owner, whichever figure is read.
    expect(numbers(rows, "incidents-owner")[0]).toBe(1);
    expect(numbers(rows, "commercial-owner")[0]).toBe(1);
  });
});
