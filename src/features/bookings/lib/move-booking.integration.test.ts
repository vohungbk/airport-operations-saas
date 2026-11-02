import { describe, expect, it } from "vitest";

import {
  AIRPORT,
  CATEGORY,
  USER,
  available,
  bookingId,
  newPartner,
  partnerId,
  run,
} from "@/lib/finance/finance-test-support";

/**
 * CO-F08-S03 (AC01, AC02, AC03): move_booking_to_next_step() moves a booking one step and its seat
 * follows; who may move to which step; a move on a stale view is refused. The function is SECURITY
 * DEFINER and reads the caller from the JWT claim, so each call sets `request.jwt.claim.sub` to a
 * demo user of the role. Every scenario runs in a transaction that is rolled back and makes its own
 * partner and booking. Skipped when the local stack is not running, like the RLS suite.
 */
const START = "2030-01-01 10:00:00+00";
const RETURN = "2030-01-04 10:00:00+00";

const OPS = USER("operations_manager");
const TECHNICIAN = USER("technician");
const OTHER_TECHNICIAN = `(select id::text from public.users u where u.role = 'technician' and u.is_active order by u.email limit 1 offset 1)`;
const PARTNER_USER = USER("partner_user");

const SEAT = `(select s.id from public.seats s where s.airport_id = '${AIRPORT}' and s.category_id = '${CATEGORY}' and s.status <> 'retired' order by s.serial_number limit 1)`;

/** The seat is put in a status as the owner, with the signal the seat guard reads. */
const seatIs = (status: string) => `
  select set_config('app.seat_status_change', 'on', true);
  update public.seats set status = '${status}' where id = ${SEAT};
  select set_config('app.seat_status_change', '', true);`;

/** A booking of its own partner, with the seat and the technician, at a step (set as the owner). */
const booking = (n: number, step: string, options: { seat?: boolean } = {}) => `
  ${newPartner(n)}
  insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate, assigned_seat_id, assigned_technician_id)
  values ('${bookingId(n)}', 'MV-${n}', '${partnerId(n)}', '${AIRPORT}', '${START}', '${RETURN}', '${CATEGORY}', 90,
          ${options.seat === false ? "null" : SEAT}, ${TECHNICIAN}::uuid);
  select set_config('app.booking_change', 'on', true);
  update public.bookings set status = '${step}' where id = '${bookingId(n)}';
  select set_config('app.booking_change', '', true);`;

/** Moves as a user (`null` is nobody signed in) and reports `R|name|ok` or `R|name|<sqlstate>|<detail>`. */
const move = (name: string, user: string | null, n: number, expected: string, note = "null") => `
  select set_config('request.jwt.claim.sub', ${user ? `coalesce(${user}, '')` : "''"}, true);
  do $$ declare d text; begin
    perform public.move_booking_to_next_step('${bookingId(n)}', '${expected}', ${note});
    raise notice 'R|${name}|ok';
  exception when others then
    get stacked diagnostics d = pg_exception_detail;
    raise notice 'R|${name}|%|%', sqlstate, coalesce(d, '');
  end $$;`;

/** Reports `R|name|<booking status>|<seat status>`. */
const state = (name: string, n: number) => `
  do $$ declare b record; s text; begin
    select status, assigned_seat_id into b from public.bookings where id = '${bookingId(n)}';
    select status::text into s from public.seats where id = b.assigned_seat_id;
    raise notice 'R|${name}|%|%', b.status, coalesce(s, 'none');
  end $$;`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("move a booking to the next step (CO-F08-S03)", () => {
  it("should move to the next step and make the seat follow, one step at a time (AC01)", () => {
    const rows = run(`
      ${booking(1, "pending")}
      ${seatIs("available")}
      ${move("confirm", OPS, 1, "pending", "'Checked'")}
      ${state("confirmed", 1)}
      ${move("assign", OPS, 1, "confirmed")}
      ${state("assigned", 1)}
      ${move("start", OPS, 1, "assigned")}
      ${state("in-progress", 1)}`);

    expect(get(rows, "confirm")).toEqual(["ok"]);
    expect(get(rows, "confirmed")).toEqual(["confirmed", "available"]);
    expect(get(rows, "assigned")).toEqual(["assigned", "reserved"]);
    expect(get(rows, "in-progress")).toEqual(["in_progress", "in_use"]);
  });

  it("should refuse a move on a stale view, and show the step the booking is at now (AC03)", () => {
    const rows = run(`
      ${booking(2, "pending")}
      ${seatIs("available")}
      ${move("first", OPS, 2, "pending")}
      ${move("second", OPS, 2, "pending")}
      ${state("after", 2)}`);

    expect(get(rows, "first")).toEqual(["ok"]);
    expect(get(rows, "second")).toEqual(["BK007", "confirmed"]);
    expect(get(rows, "after")).toEqual(["confirmed", "available"]);
  });

  it("should let the assigned technician move the field steps only (AC02)", () => {
    const rows = run(`
      ${booking(3, "confirmed")}
      ${seatIs("available")}
      ${move("tech-assign", TECHNICIAN, 3, "confirmed")}
      ${move("ops-assign", OPS, 3, "confirmed")}
      ${move("tech-start", TECHNICIAN, 3, "assigned")}
      ${state("after", 3)}`);

    expect(get(rows, "tech-assign")[0]).toBe("42501");
    expect(get(rows, "ops-assign")).toEqual(["ok"]);
    expect(get(rows, "tech-start")).toEqual(["ok"]);
    expect(get(rows, "after")).toEqual(["in_progress", "in_use"]);
  });

  it("should refuse a technician who is not assigned, a partner user and nobody signed in (AC02)", () => {
    const rows = run(`
      ${booking(4, "assigned")}
      ${seatIs("reserved")}
      ${move("other-tech", OTHER_TECHNICIAN, 4, "assigned")}
      ${move("partner", PARTNER_USER, 4, "assigned")}
      ${move("nobody", null, 4, "assigned")}
      ${state("after", 4)}`);

    expect(get(rows, "other-tech")[0]).toBe("42501");
    expect(get(rows, "partner")[0]).toBe("42501");
    expect(get(rows, "nobody")[0]).toBe("42501");
    expect(get(rows, "after")).toEqual(["assigned", "reserved"]);
  });

  it("should not move to the next step when the seat is not ready, and say what the seat is (AC01)", () => {
    const rows = run(`
      ${booking(5, "confirmed")}
      ${seatIs("cleaning")}
      ${move("assign", OPS, 5, "confirmed")}
      ${state("after", 5)}`);

    expect(get(rows, "assign")).toEqual(["BK009", "cleaning"]);
    expect(get(rows, "after")).toEqual(["confirmed", "cleaning"]);
  });

  it("should ask for a seat when the booking has none (AC01)", () => {
    const rows = run(`
      ${booking(6, "confirmed", { seat: false })}
      ${move("assign", OPS, 6, "confirmed")}`);

    expect(get(rows, "assign")[0]).toBe("BK008");
  });

  it("should not move a booking at the last step or off the path", () => {
    const rows = run(`
      ${booking(7, "confirmed")}
      ${seatIs("available")}
      select set_config('app.booking_change', 'on', true);
      update public.bookings set status = 'cancelled' where id = '${bookingId(7)}';
      select set_config('app.booking_change', '', true);
      ${move("cancelled", OPS, 7, "cancelled")}`);

    expect(get(rows, "cancelled")[0]).toBe("55000");
  });
});
