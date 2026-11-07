import { describe, expect, it } from "vitest";

import { AIRPORT, CATEGORY, FLAG_ON, PARTNER, USER, available, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F05-S02: the two additional KPI functions count the right rows and only the rows the caller may
 * read. Every scenario runs in a transaction that is rolled back and makes its own bookings, seats,
 * jobs and refunds, in a period of 2032 that holds no demo data. Skipped when the local stack is not
 * running.
 */
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";
const TECH = USER("technician");

const FROM = "2032-01-01 00:00:00+00";
const TO = "2032-02-01 00:00:00+00";
const PICKUP = "2032-01-05 10:00:00+00";
const RETURN = "2032-01-10 10:00:00+00";

const pad = (n: number) => String(n).padStart(12, "0");
const bookingId = (n: number) => `da600000-0000-0000-0000-${pad(n)}`;
const seatId = (n: number) => `da800000-0000-0000-0000-${pad(n)}`;

const seat = (n: number) => `
  insert into public.seats (id, serial_number, manufacturer, model, category_id, airport_id, manufacture_date, purchase_date, max_rental_cycles)
  values ('${seatId(n)}', 'KA-SEAT-${n}', 'Test', 'Test', '${CATEGORY}', '${AIRPORT}', date '2029-01-01', date '2029-01-01', 100);`;

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
  values ('${bookingId(n)}', 'KA-${n}', '${o.partner ?? PARTNER}', '${AIRPORT}', '${PICKUP}', '${o.ret ?? RETURN}', '${CATEGORY}', 90, ${o.seat ? `'${seatId(n)}'` : "null"});
  ${FLAG_ON} update public.bookings set status = '${o.status ?? "completed"}' where id = '${bookingId(n)}';`;

const refund = (n: number, type: string, amount: number) => `
  insert into public.booking_adjustments (booking_id, type, amount, reason)
  values ('${bookingId(n)}', '${type}', ${amount}, 'KPI test');`;

/** A completed installation job; the booking is still active when it is made, as the guard of the job insert asks. */
const installJob = (n: number, start: string | null, end: string) => `
  insert into public.technician_jobs (booking_id, technician_id, job_type, status, started_at, completed_at)
  values ('${bookingId(n)}', ${TECH}::uuid, 'installation', 'completed', ${start ? `'${start}'` : "null"}, '${end}');`;

const additional = (name: string) => `
  do $$ declare r record; begin
    select * into r from public.kpi_additional_figures('${FROM}', '${TO}');
    raise notice 'R|${name}|%|%|%|%|%|%|%|%|%', r.completed_bookings, r.paid_days, r.replacements, r.refund_amount,
      r.refunded_bookings, r.installation_jobs, r.installation_timed, r.installation_minutes, r.prepared_bookings;
  end $$;`;

const numbers = (rows: string[][], name: string) => rows.find((row) => row[0] === name)?.slice(1).map(Number) ?? [];

describe.skipIf(!available)("additional KPI figures of the bookings (VI-F05-S02, AC01)", () => {
  it("should count only the bookings completed in the period", () => {
    const rows = run(`
      ${booking(1)}
      ${booking(2, { status: "returned" })}
      ${booking(3, { status: "in_progress" })}
      ${booking(4, { ret: "2032-03-10 10:00:00+00" })}
      ${additional("figures")}`);

    // 1 and 2 are over in the period; 3 is still active and 4 returns after the period.
    expect(numbers(rows, "figures")[0]).toBe(2);
  });

  it("should sum the partial and full refunds, count the refunded bookings, and ignore the other adjustments", () => {
    const rows = run(`
      ${booking(1)}${refund(1, "partial_refund", 50)}${refund(1, "full_refund", 40)}
      ${booking(2)}${refund(2, "partial_refund", 60)}
      ${booking(3)}${refund(3, "chargeback", 500)}
      ${booking(4, { status: "in_progress" })}${refund(4, "full_refund", 900)}
      ${additional("figures")}`);

    const [, , , amount, refunded] = numbers(rows, "figures");

    expect(amount).toBe(150);
    expect(refunded).toBe(2);
  });

  it("should count a seat swap as a replacement and a first assignment as none", () => {
    const rows = run(`
      ${booking(1, { seat: true })}
      ${seat(11)}
      ${FLAG_ON} update public.bookings set assigned_seat_id = '${seatId(11)}' where id = '${bookingId(1)}';
      ${booking(2)}
      ${seat(12)}
      ${FLAG_ON} update public.bookings set assigned_seat_id = '${seatId(12)}' where id = '${bookingId(2)}';
      ${additional("figures")}`);

    // Booking 1 had a seat and got another one; booking 2 had no seat, so its assignment is the first.
    expect(numbers(rows, "figures")[2]).toBe(1);
  });

  it("should average the installation time of the jobs that have a start, and leave the others out", () => {
    const rows = run(`
      insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate)
      values ('${bookingId(1)}', 'KA-1', '${PARTNER}', '${AIRPORT}', '${PICKUP}', '${RETURN}', '${CATEGORY}', 90),
             ('${bookingId(2)}', 'KA-2', '${PARTNER}', '${AIRPORT}', '${PICKUP}', '${RETURN}', '${CATEGORY}', 90);
      ${installJob(1, "2032-01-05 10:00:00+00", "2032-01-05 10:12:00+00")}
      ${installJob(2, null, "2032-01-05 11:00:00+00")}
      ${FLAG_ON} update public.bookings set status = 'completed' where id in ('${bookingId(1)}', '${bookingId(2)}');
      ${additional("figures")}`);

    const [, , , , , jobs, timed, minutes] = numbers(rows, "figures");

    expect(jobs).toBe(2);
    expect(timed).toBe(1);
    expect(minutes).toBe(12);
  });

  it("should count a booking that reached Ready as prepared, whether or not it has a Preparation step", () => {
    const rows = run(`
      insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate)
      values ('${bookingId(1)}', 'KA-1', '${PARTNER}', '${AIRPORT}', '${PICKUP}', '${RETURN}', '${CATEGORY}', 90),
             ('${bookingId(2)}', 'KA-2', '${PARTNER}', '${AIRPORT}', '${PICKUP}', '${RETURN}', '${CATEGORY}', 90);
      ${FLAG_ON} update public.bookings set status = 'preparation' where id = '${bookingId(1)}';
      ${FLAG_ON} update public.bookings set status = 'ready' where id in ('${bookingId(1)}', '${bookingId(2)}');
      ${FLAG_ON} update public.bookings set status = 'completed' where id in ('${bookingId(1)}', '${bookingId(2)}');
      ${additional("figures")}`);

    const [, , , , , , , , prepared] = numbers(rows, "figures");

    expect(prepared).toBe(2);
  });
});

describe.skipIf(!available)("who is counted (VI-F05-S02, AC01, E5)", () => {
  const userOf = (name: string, partner: string) => `
    select set_config('t.${name}', coalesce(
      (select id::text from public.users u where u.role = 'partner_user' and u.is_active and u.partner_id = '${partner}' order by u.email limit 1), ''), true);`;

  const asPartnerUser = (name: string) => `
    set local role authenticated;
    select set_config('request.jwt.claim.sub', current_setting('t.${name}'), true);
    ${additional(`figures-${name}`)}
    reset role;`;

  it("should count only the bookings and refunds of the partner of a partner user, never another partner's (cross-tenant denial)", () => {
    const rows = run(`
      ${userOf("owner", PARTNER)}
      ${userOf("other", OTHER_PARTNER)}
      do $$ begin
        raise notice 'R|have|%|%', current_setting('t.owner') <> '', current_setting('t.other') <> '';
      end $$;
      ${booking(1, { partner: PARTNER })}${refund(1, "partial_refund", 20)}
      ${booking(2, { partner: OTHER_PARTNER })}${refund(2, "partial_refund", 30)}
      ${booking(3, { partner: OTHER_PARTNER })}
      ${additional("figures-everyone")}
      ${asPartnerUser("owner")}
      ${asPartnerUser("other")}`);

    expect(rows.find((row) => row[0] === "have")?.slice(1)).toEqual(["t", "t"]);
    expect(numbers(rows, "figures-everyone")[0]).toBe(3);
    expect(numbers(rows, "figures-owner").slice(0, 5)).toEqual([1, numbers(rows, "figures-owner")[1], 0, 20, 1]);
    expect(numbers(rows, "figures-other")[0]).toBe(2);
    expect(numbers(rows, "figures-other")[3]).toBe(30);
  });
});

describe.skipIf(!available)("seat inventory figures (VI-F05-S02, AC01)", () => {
  const inventory = (name: string) => `
    do $$ declare r record; begin
      select * into r from public.kpi_seat_inventory_figures('${FROM}', '${TO}');
      raise notice 'R|${name}|%|%|%', r.seats_in_service, r.available_seats, r.airport_codes;
    end $$;`;

  const expected = `
    do $$ begin
      raise notice 'R|expected|%|%',
        (select count(*) from public.seats where status <> 'retired' and retired_at is null),
        (select count(*) from public.seats where status = 'available');
    end $$;`;

  const userOf = (role: string) => `
    select set_config('t.${role}', coalesce((select id::text from public.users u where u.role = '${role}' and u.is_active order by u.email limit 1), ''), true);`;

  const asUser = (role: string, statements: string) => `
    set local role authenticated;
    select set_config('request.jwt.claim.sub', current_setting('t.${role}'), true);
    ${statements}
    reset role;`;

  it("should give a partner user the stock of the whole airport, not only the seats on its own bookings", () => {
    const rows = run(`
      ${userOf("partner_user")}
      ${seat(1)}${seat(2)}
      ${expected}
      ${asUser("partner_user", inventory("partner"))}`);

    const [inService, availableSeats] = numbers(rows, "partner");
    const [expectedInService, expectedAvailable] = numbers(rows, "expected");

    // Every seat of the database is counted, whoever its bookings belong to; a retired seat is in neither number.
    expect(inService).toBe(expectedInService);
    expect(availableSeats).toBe(expectedAvailable);
    expect(rows.find((row) => row[0] === "partner")?.[3]).toContain("DXB");
  });

  it("should refuse a technician, who has no KPI dashboard, and give nothing to a caller without a profile", () => {
    const attempt = (name: string) => `
      do $$ begin
        perform * from public.kpi_seat_inventory_figures('${FROM}', '${TO}');
        raise notice 'R|${name}|allowed';
      exception when insufficient_privilege then
        raise notice 'R|${name}|denied';
      end $$;`;

    const rows = run(`
      ${userOf("technician")}
      ${asUser("technician", attempt("technician"))}
      set local role authenticated;
      select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
      ${attempt("unknown")}
      reset role;`);

    expect(rows.find((row) => row[0] === "technician")?.[1]).toBe("denied");
    expect(rows.find((row) => row[0] === "unknown")?.[1]).toBe("denied");
  });
});
