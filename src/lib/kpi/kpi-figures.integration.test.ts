import { describe, expect, it } from "vitest";

import { AIRPORT, CATEGORY, FLAG_ON, PARTNER, USER, available, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F05-T02: the KPI functions count the right rows (Arrivals today, Installations due, Correct-seat
 * fulfilment, On-time readiness) and only the rows the caller may read. Every scenario runs in a
 * transaction that is rolled back and makes its own bookings, seats, jobs and installations. Figures that
 * could pick up demo data are read before and after the scenario and compared. Skipped when the local
 * stack is not running.
 */
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";
const TECH = USER("technician");

/** Dubai is UTC+4: the local day of NOW is 2030-03-09 20:00 UTC to 2030-03-10 20:00 UTC. */
const NOW = "2030-03-10 12:00:00+00";
const TIME_ZONE = `update public.airports set timezone = 'Asia/Dubai' where id = '${AIRPORT}';`;

const pad = (n: number) => String(n).padStart(12, "0");
const bookingId = (n: number) => `d9500000-0000-0000-0000-${pad(n)}`;
const jobId = (n: number) => `d9600000-0000-0000-0000-${pad(n)}`;
const seatId = (n: number) => `d9700000-0000-0000-0000-${pad(n)}`;
const flightId = (n: number) => `d9800000-0000-0000-0000-${pad(n)}`;

const seat = (n: number) => `
  insert into public.seats (id, serial_number, manufacturer, model, category_id, airport_id, manufacture_date, purchase_date, max_rental_cycles)
  values ('${seatId(n)}', 'KF-SEAT-${n}', 'Test', 'Test', '${CATEGORY}', '${AIRPORT}', date '2029-01-01', date '2029-01-01', 100);`;

interface BookingOptions {
  pickup?: string;
  ret?: string;
  partner?: string;
  status?: string;
  seat?: boolean;
}

/** A booking, in the status asked for, with its own seat when `seat` is set. */
const booking = (n: number, o: BookingOptions = {}) => `
  ${o.seat ? seat(n) : ""}
  insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate, assigned_seat_id, assigned_technician_id)
  values ('${bookingId(n)}', 'KF-${n}', '${o.partner ?? PARTNER}', '${AIRPORT}', '${o.pickup ?? NOW}',
          timestamptz '${o.ret ?? o.pickup ?? NOW}' + interval '3 days', '${CATEGORY}', 90, ${o.seat ? `'${seatId(n)}'` : "null"}, ${TECH}::uuid);
  ${o.status ? `${FLAG_ON} update public.bookings set status = '${o.status}' where id = '${bookingId(n)}';` : ""}`;

const job = (n: number, type = "installation") => `
  insert into public.technician_jobs (id, booking_id, technician_id, job_type)
  values ('${jobId(n)}', '${bookingId(n)}', ${TECH}::uuid, '${type}');`;

/** The installation of booking n (it needs a seat and a job); `match` is the result of the seat scan. */
const installation = (n: number, match: boolean | null) => `
  insert into public.installations (technician_job_id, completed_at, installation_completed)
  values ('${jobId(n)}', now(), true);
  update public.installations set seat_match = ${match === null ? "null" : match} where technician_job_id = '${jobId(n)}';`;

const flight = (n: number, estimated: string) => `
  insert into public.flights (id, flight_number, airport_id, scheduled_arrival_at, estimated_arrival_at)
  values ('${flightId(n)}', 'KF ${n}', '${AIRPORT}', '${NOW}', '${estimated}');
  update public.bookings set flight_id = '${flightId(n)}' where id = '${bookingId(n)}';`;

const today = (name: string) => `
  do $$ declare r record; begin
    select * into r from public.kpi_today_figures('${NOW}');
    raise notice 'R|${name}|%|%', r.arrivals_today, r.installations_due;
  end $$;`;

const seatFigures = (name: string, from: string, to: string) => `
  do $$ declare r record; begin
    select * into r from public.kpi_correct_seat_figures('${from}', '${to}');
    raise notice 'R|${name}|%|%|%', r.completed_bookings, r.with_result, r.matched;
  end $$;`;

const readinessFigures = (name: string) => `
  do $$ declare r record; begin
    select * into r from public.kpi_on_time_readiness_figures(now() - interval '1 day', now() + interval '1 day');
    raise notice 'R|${name}|%|%|%', r.family_ready_bookings, r.with_deadline, r.on_time;
  end $$;`;

const numbers = (rows: string[][], name: string) => rows.find((row) => row[0] === name)?.slice(1).map(Number) ?? [];
const delta = (rows: string[][], before: string, after: string) =>
  numbers(rows, after).map((value, index) => value - (numbers(rows, before)[index] ?? 0));

describe.skipIf(!available)("Arrivals today and Installations due (VI-F05-T02, AC01, AC02)", () => {
  it("should count the bookings that arrive today at the airport, by the airport day, and skip cancelled ones", () => {
    const rows = run(`
      ${TIME_ZONE}
      ${today("before")}
      ${booking(1, { pickup: "2030-03-10 08:00:00+00" })}
      ${booking(2, { pickup: "2030-03-10 19:59:00+00" })}
      ${booking(3, { pickup: "2030-03-10 20:00:00+00" })}
      ${booking(4, { pickup: "2030-03-09 19:59:00+00" })}
      ${booking(5, { pickup: "2030-03-10 08:00:00+00", status: "cancelled" })}
      ${today("after")}`);

    // Bookings 1 and 2 are on 10 March in Dubai. 3 is 00:00 on 11 March, 4 is 23:59 on 9 March, 5 is cancelled.
    expect(delta(rows, "before", "after")[0]).toBe(2);
  });

  it("should use the estimated arrival of a linked flight instead of the pickup time", () => {
    const rows = run(`
      ${TIME_ZONE}
      ${today("before")}
      ${booking(1, { pickup: "2030-03-10 08:00:00+00" })}
      ${flight(1, "2030-03-11 08:00:00+00")}
      ${booking(2, { pickup: "2030-03-11 08:00:00+00" })}
      ${flight(2, "2030-03-10 09:00:00+00")}
      ${today("after")}`);

    // 1 has pickup today but its flight lands tomorrow; 2 has pickup tomorrow but its flight lands today.
    expect(delta(rows, "before", "after")[0]).toBe(1);
  });

  it("should count only bookings with pickup today and no installation record, and drop one when its installation is recorded", () => {
    const rows = run(`
      ${TIME_ZONE}
      ${today("before")}
      ${booking(1, { pickup: "2030-03-10 08:00:00+00", seat: true })}
      ${job(1)}
      ${booking(2, { pickup: "2030-03-10 09:00:00+00", seat: true })}
      ${job(2)}
      ${booking(3, { pickup: "2030-03-10 10:00:00+00", status: "cancelled" })}
      ${booking(4, { pickup: "2030-03-11 10:00:00+00" })}
      ${today("without-record")}
      ${installation(1, true)}
      ${today("with-record")}`);

    expect(delta(rows, "before", "without-record")[1]).toBe(2);
    expect(delta(rows, "before", "with-record")[1]).toBe(1);
  });
});

describe.skipIf(!available)("Correct-seat fulfilment (VI-F05-T02, AC04, AC06, AC07)", () => {
  const FROM = "2031-01-01 00:00:00+00";
  const TO = "2031-02-01 00:00:00+00";
  const RETURN = "2031-01-10 10:00:00+00";

  const completed = (n: number, match: boolean | null, status = "completed") =>
    `${booking(n, { pickup: "2031-01-05 10:00:00+00", ret: RETURN, status, seat: true })}${job(n)}${installation(n, match)}`;

  it("should count completed bookings whose seat matched, and the ones with a stored result", () => {
    const rows = run(`
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => completed(n, true)).join("\n")}
      ${completed(10, false, "returned")}
      ${seatFigures("figures", FROM, TO)}`);

    expect(numbers(rows, "figures")).toEqual([10, 10, 9]);
  });

  it("should leave a booking with no stored result out of the rate and still count it as completed", () => {
    const rows = run(`
      ${completed(1, true)}
      ${completed(2, null)}
      ${booking(3, { pickup: "2031-01-05 10:00:00+00", ret: RETURN, status: "completed" })}
      ${seatFigures("figures", FROM, TO)}`);

    expect(numbers(rows, "figures")).toEqual([3, 1, 1]);
  });

  it("should count nothing when no booking is completed in the period, and skip bookings still in progress", () => {
    const rows = run(`
      ${booking(1, { pickup: "2031-01-05 10:00:00+00", ret: RETURN, status: "in_progress" })}
      ${booking(2, { pickup: "2031-03-05 10:00:00+00", ret: "2031-03-10 10:00:00+00", status: "completed" })}
      ${seatFigures("figures", FROM, TO)}`);

    expect(numbers(rows, "figures")).toEqual([0, 0, 0]);
  });
});

describe.skipIf(!available)("On-time readiness (VI-F05-T02, AC05, AC07)", () => {
  /** Pickup in 2040 gives a deadline in 2040 (on time now); pickup in 2000 gives one in 2000 (late now). */
  const familyReady = (n: number, pickup: string, type = "installation") =>
    `${booking(n, { pickup })}${job(n, type)}${FLAG_ON} update public.bookings set status = 'family_ready' where id = '${bookingId(n)}';`;

  it("should count the Family Ready bookings that are on time, late, and without a stored deadline", () => {
    const rows = run(`
      ${readinessFigures("before")}
      ${familyReady(1, "2040-01-10 12:00:00+00")}
      ${familyReady(2, "2040-01-11 12:00:00+00")}
      ${familyReady(3, "2000-01-10 12:00:00+00")}
      ${familyReady(4, "2040-01-12 12:00:00+00", "cleaning")}
      ${readinessFigures("after")}`);

    // Four Family Ready bookings; three have a deadline; two of those are on time.
    expect(delta(rows, "before", "after")).toEqual([4, 3, 2]);
  });
});

describe.skipIf(!available)("who is counted (VI-F05-T02, AC08)", () => {
  const userOf = (name: string, partner: string) => `
    select set_config('t.${name}', coalesce(
      (select id::text from public.users u where u.role = 'partner_user' and u.is_active and u.partner_id = '${partner}' order by u.email limit 1), ''), true);`;

  const asPartnerUser = (name: string) => `
    set local role authenticated;
    select set_config('request.jwt.claim.sub', current_setting('t.${name}'), true);
    ${today(`seen-by-${name}`)}
    reset role;`;

  it("should count only the rows of the partner of a partner user, never the rows of another partner (cross-tenant denial)", () => {
    const rows = run(`
      ${userOf("owner", PARTNER)}
      ${userOf("other", OTHER_PARTNER)}
      do $$ begin
        raise notice 'R|have|%|%', current_setting('t.owner') <> '', current_setting('t.other') <> '';
      end $$;
      ${TIME_ZONE}
      ${asPartnerUser("owner")}
      ${asPartnerUser("other")}
      ${today("everyone-before")}
      ${booking(1, { pickup: "2030-03-10 08:00:00+00", partner: PARTNER })}
      ${booking(2, { pickup: "2030-03-10 09:00:00+00", partner: OTHER_PARTNER })}
      ${booking(3, { pickup: "2030-03-10 10:00:00+00", partner: OTHER_PARTNER })}
      ${today("everyone-after")}
      ${asPartnerUser("owner")}
      ${asPartnerUser("other")}`);

    const seenByOwner = rows.filter((row) => row[0] === "seen-by-owner").map((row) => Number(row[1]));
    const seenByOther = rows.filter((row) => row[0] === "seen-by-other").map((row) => Number(row[1]));

    expect(rows.find((row) => row[0] === "have")?.slice(1)).toEqual(["t", "t"]);
    expect(delta(rows, "everyone-before", "everyone-after")[0]).toBe(3);
    // Rows come in the order of the script: before the bookings, then after.
    expect(seenByOwner[1] - seenByOwner[0]).toBe(1);
    expect(seenByOther[1] - seenByOther[0]).toBe(2);
  });
});
