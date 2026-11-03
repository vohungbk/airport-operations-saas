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
 * CO-F08-S08 (AC01): change_booking_status() cancels a booking in any step before completed, the
 * workflow ends, and the seat the booking holds is released. The function is SECURITY DEFINER and
 * reads the caller from the JWT claim, so each call sets `request.jwt.claim.sub` to a demo user of
 * the role. Every scenario runs in a transaction that is rolled back and makes its own partner and
 * booking. Skipped when the local stack is not running, like the RLS suite.
 */
const START = "2030-01-01 10:00:00+00";
const RETURN = "2030-01-04 10:00:00+00";

const OPS = USER("operations_manager");
const TECHNICIAN = USER("technician");
const PARTNER_USER = USER("partner_user");

const SEAT = `(select s.id from public.seats s where s.airport_id = '${AIRPORT}' and s.category_id = '${CATEGORY}' and s.status <> 'retired' order by s.serial_number limit 1)`;

/** The seat is put in a status as the owner, with the signal the seat guard reads. */
const seatIs = (status: string) => `
  select set_config('app.seat_status_change', 'on', true);
  update public.seats set status = '${status}' where id = ${SEAT};
  select set_config('app.seat_status_change', '', true);`;

/** A booking of its own partner, with the seat, at a step (set as the owner). */
const booking = (n: number, step: string, options: { seat?: boolean } = {}) => `
  ${newPartner(n)}
  insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate, assigned_seat_id, assigned_technician_id)
  values ('${bookingId(n)}', 'CX-${n}', '${partnerId(n)}', '${AIRPORT}', '${START}', '${RETURN}', '${CATEGORY}', 90,
          ${options.seat === false ? "null" : SEAT}, ${TECHNICIAN}::uuid);
  select set_config('app.booking_change', 'on', true);
  update public.bookings set status = '${step}' where id = '${bookingId(n)}';
  select set_config('app.booking_change', '', true);`;

/** Changes the status as a user (`null` is nobody signed in) and reports `R|name|ok` or `R|name|<sqlstate>`. */
const changeStatus = (name: string, user: string | null, n: number, to: string, reason = "'Customer called'") => `
  select set_config('request.jwt.claim.sub', ${user ? `coalesce(${user}, '')` : "''"}, true);
  do $$ begin
    perform public.change_booking_status('${bookingId(n)}', '${to}', ${reason});
    raise notice 'R|${name}|ok';
  exception when others then
    raise notice 'R|${name}|%', sqlstate;
  end $$;`;

/** Reports `R|name|<booking status>|<seat status>`. */
const state = (name: string, n: number) => `
  do $$ declare b record; s text; begin
    select status, assigned_seat_id into b from public.bookings where id = '${bookingId(n)}';
    select status::text into s from public.seats where id = b.assigned_seat_id;
    raise notice 'R|${name}|%|%', b.status, coalesce(s, 'none');
  end $$;`;

/** Reports `R|name|<seat history reason>|<booking event notes>` of the cancellation. */
const audit = (name: string, n: number) => `
  do $$ declare r text; e text; begin
    select h.reason into r from public.seat_status_history h
     where h.seat_id = ${SEAT} and h.to_status = 'available' and h.reason like 'Booking CX-${n} %';
    select ev.notes into e from public.booking_events ev
     where ev.booking_id = '${bookingId(n)}' and ev.to_status = 'cancelled';
    raise notice 'R|${name}|%|%', coalesce(r, 'none'), coalesce(e, 'none');
  end $$;`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("cancel a booking and release its seat (CO-F08-S08)", () => {
  it("should end the workflow and release the reserved seat when a booking is cancelled at assigned (AC01)", () => {
    const rows = run(`
      ${booking(1, "assigned")}
      ${seatIs("reserved")}
      ${changeStatus("cancel", OPS, 1, "cancelled")}
      ${state("after", 1)}
      ${audit("audit", 1)}`);

    expect(get(rows, "cancel")).toEqual(["ok"]);
    expect(get(rows, "after")).toEqual(["cancelled", "available"]);
    expect(get(rows, "audit")).toEqual(["Booking CX-1 cancelled", "Customer called"]);
  });

  it("should end the workflow and release the seat in use when a booking is cancelled at in_progress (AC01)", () => {
    const rows = run(`
      ${booking(2, "in_progress")}
      ${seatIs("in_use")}
      ${changeStatus("cancel", OPS, 2, "cancelled")}
      ${state("after", 2)}`);

    expect(get(rows, "cancel")).toEqual(["ok"]);
    expect(get(rows, "after")).toEqual(["cancelled", "available"]);
  });

  it("should leave an available seat alone when a booking is cancelled before a step that holds a seat (AC01)", () => {
    const rows = run(`
      ${booking(3, "confirmed")}
      ${seatIs("available")}
      ${changeStatus("cancel", OPS, 3, "cancelled")}
      ${state("after", 3)}`);

    expect(get(rows, "cancel")).toEqual(["ok"]);
    expect(get(rows, "after")).toEqual(["cancelled", "available"]);
  });

  it("should cancel a booking that has no seat, with nothing to release (AC01)", () => {
    const rows = run(`
      ${booking(4, "assigned", { seat: false })}
      ${changeStatus("cancel", OPS, 4, "cancelled")}
      ${state("after", 4)}`);

    expect(get(rows, "cancel")).toEqual(["ok"]);
    expect(get(rows, "after")).toEqual(["cancelled", "none"]);
  });

  it("should leave the seat alone when it is no longer in the status the step holds (AC01)", () => {
    const rows = run(`
      ${booking(5, "assigned")}
      ${seatIs("quarantine")}
      ${changeStatus("cancel", OPS, 5, "cancelled")}
      ${state("after", 5)}`);

    expect(get(rows, "cancel")).toEqual(["ok"]);
    expect(get(rows, "after")).toEqual(["cancelled", "quarantine"]);
  });

  it("should refuse to cancel again and keep the seat released (AC01)", () => {
    const rows = run(`
      ${booking(6, "assigned")}
      ${seatIs("reserved")}
      ${changeStatus("first", OPS, 6, "cancelled")}
      ${changeStatus("second", OPS, 6, "cancelled")}
      ${state("after", 6)}`);

    expect(get(rows, "first")).toEqual(["ok"]);
    expect(get(rows, "second")).toEqual(["55000"]);
    expect(get(rows, "after")).toEqual(["cancelled", "available"]);
  });

  it("should refuse to cancel a completed booking (AC01)", () => {
    const rows = run(`
      ${booking(7, "completed")}
      ${seatIs("available")}
      ${changeStatus("cancel", OPS, 7, "cancelled")}
      ${state("after", 7)}`);

    expect(get(rows, "cancel")).toEqual(["55000"]);
    expect(get(rows, "after")).toEqual(["completed", "available"]);
  });

  it("should refuse a cancellation without a reason, and keep the booking and the seat as they were (AC01)", () => {
    const rows = run(`
      ${booking(8, "assigned")}
      ${seatIs("reserved")}
      ${changeStatus("cancel", OPS, 8, "cancelled", "null")}
      ${state("after", 8)}`);

    expect(get(rows, "cancel")).toEqual(["22023"]);
    expect(get(rows, "after")).toEqual(["assigned", "reserved"]);
  });

  it("should refuse to mark a booking that is assigned as a no-show (AC01)", () => {
    const rows = run(`
      ${booking(9, "assigned")}
      ${seatIs("reserved")}
      ${changeStatus("no-show", OPS, 9, "no_show")}
      ${state("after", 9)}`);

    expect(get(rows, "no-show")).toEqual(["55000"]);
    expect(get(rows, "after")).toEqual(["assigned", "reserved"]);
  });

  it("should refuse a technician, a partner user and nobody signed in, and change nothing (AC01)", () => {
    const rows = run(`
      ${booking(10, "assigned")}
      ${seatIs("reserved")}
      ${changeStatus("technician", TECHNICIAN, 10, "cancelled")}
      ${changeStatus("partner", PARTNER_USER, 10, "cancelled")}
      ${changeStatus("nobody", null, 10, "cancelled")}
      ${state("after", 10)}`);

    expect(get(rows, "technician")).toEqual(["42501"]);
    expect(get(rows, "partner")).toEqual(["42501"]);
    expect(get(rows, "nobody")).toEqual(["42501"]);
    expect(get(rows, "after")).toEqual(["assigned", "reserved"]);
  });
});
