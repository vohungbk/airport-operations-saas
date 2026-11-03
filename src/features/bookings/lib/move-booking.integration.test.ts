import { describe, expect, it } from "vitest";

import { SEAT_FOLLOWS } from "@/features/bookings/lib/booking-move";
import { BOOKING_BOARD_STEPS } from "@/lib/workflow/board";
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
 * CO-F08-S03 (AC01, AC02, AC03), on the 13-step path: move_booking_to_next_step() moves a booking one step and its seat
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

/** Sets the status by hand as a user and reports `R|name|ok` or `R|name|<sqlstate>`. */
const changeStatus = (name: string, user: string, n: number, to: string) => `
  select set_config('request.jwt.claim.sub', coalesce(${user}, ''), true);
  do $$ begin
    perform public.change_booking_status('${bookingId(n)}', '${to}', null);
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
      ${move("prepare", OPS, 1, "confirmed")}
      ${move("ready", OPS, 1, "preparation")}
      ${state("ready", 1)}
      ${move("assign", OPS, 1, "ready")}
      ${state("assigned", 1)}
      ${move("en-route", OPS, 1, "assigned")}
      ${move("installed", OPS, 1, "en_route")}
      ${move("family-ready", OPS, 1, "installed")}
      ${state("family-ready", 1)}
      ${move("start", OPS, 1, "family_ready")}
      ${state("in-progress", 1)}
      ${move("return", OPS, 1, "in_progress")}
      ${state("returned", 1)}
      ${move("clean", OPS, 1, "returned")}
      ${move("inspect", OPS, 1, "cleaning")}
      ${move("available", OPS, 1, "inspection")}
      ${state("available", 1)}`);

    expect(get(rows, "confirm")).toEqual(["ok"]);
    expect(get(rows, "confirmed")).toEqual(["confirmed", "available"]);
    expect(get(rows, "ready")).toEqual(["ready", "available"]);
    expect(get(rows, "assigned")).toEqual(["assigned", "reserved"]);
    expect(get(rows, "family-ready")).toEqual(["family_ready", "reserved"]);
    expect(get(rows, "in-progress")).toEqual(["in_progress", "in_use"]);
    expect(get(rows, "returned")).toEqual(["returned", "available"]);
    expect(get(rows, "available")).toEqual(["completed", "available"]);
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
      ${booking(3, "ready")}
      ${seatIs("available")}
      ${move("tech-assign", TECHNICIAN, 3, "ready")}
      ${move("ops-assign", OPS, 3, "ready")}
      ${move("tech-en-route", TECHNICIAN, 3, "assigned")}
      ${move("tech-installed", TECHNICIAN, 3, "en_route")}
      ${move("tech-family-ready", TECHNICIAN, 3, "installed")}
      ${move("tech-start", TECHNICIAN, 3, "family_ready")}
      ${state("after", 3)}`);

    expect(get(rows, "tech-assign")[0]).toBe("42501");
    expect(get(rows, "ops-assign")).toEqual(["ok"]);
    expect(get(rows, "tech-en-route")).toEqual(["ok"]);
    expect(get(rows, "tech-installed")).toEqual(["ok"]);
    expect(get(rows, "tech-family-ready")).toEqual(["ok"]);
    expect(get(rows, "tech-start")[0]).toBe("42501");
    expect(get(rows, "after")).toEqual(["family_ready", "reserved"]);
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
      ${booking(5, "ready")}
      ${seatIs("cleaning")}
      ${move("assign", OPS, 5, "ready")}
      ${state("after", 5)}`);

    expect(get(rows, "assign")).toEqual(["BK009", "cleaning"]);
    expect(get(rows, "after")).toEqual(["ready", "cleaning"]);
  });

  it("should ask for a seat when the booking has none (AC01)", () => {
    const rows = run(`
      ${booking(6, "ready", { seat: false })}
      ${move("assign", OPS, 6, "ready")}`);

    expect(get(rows, "assign")[0]).toBe("BK008");
  });

  it("should release the seat when the rental is returned, and let only the office move that step (CO-F08-S04 AC01)", () => {
    const rows = run(`
      ${booking(8, "in_progress")}
      ${seatIs("in_use")}
      ${move("tech-return", TECHNICIAN, 8, "in_progress")}
      ${move("complete", OPS, 8, "in_progress")}
      ${state("after", 8)}
      do $$ declare v_to text; begin
        select h.to_status::text into v_to from public.seat_status_history h
         where h.seat_id = ${SEAT} and h.reason like 'Booking MV-8 %' limit 1;
        raise notice 'R|history|%', coalesce(v_to, 'none');
      end $$;`);

    expect(get(rows, "tech-return")[0]).toBe("42501");
    expect(get(rows, "complete")).toEqual(["ok"]);
    expect(get(rows, "after")).toEqual(["returned", "available"]);
    expect(get(rows, "history")).toEqual(["available"]);
  });

  it("should leave the seat and the booking where they are when the seat is not in use at return (CO-F08-S04 AC02)", () => {
    const rows = run(`
      ${booking(9, "in_progress")}
      ${seatIs("quarantine")}
      ${move("complete", OPS, 9, "in_progress")}
      ${state("after", 9)}`);

    expect(get(rows, "complete")).toEqual(["BK009", "quarantine"]);
    expect(get(rows, "after")).toEqual(["in_progress", "quarantine"]);
  });

  it("should keep the screen rule in step with the database rule (CO-F08-S04)", () => {
    const rows = run(`
      do $$ declare s public.booking_status; r record; begin
        foreach s in array enum_range(null::public.booking_status) loop
          select * into r from public.booking_seat_rule(s);
          raise notice 'R|%|%|%', s, coalesce(r.seat_from::text, 'none'), coalesce(r.seat_to::text, 'none');
        end loop;
      end $$;`);

    for (const step of BOOKING_BOARD_STEPS) {
      const rule = SEAT_FOLLOWS[step];
      expect(get(rows, step), step).toEqual(rule ? [rule.from, rule.to] : ["none", "none"]);
    }
    for (const step of ["cancelled", "no_show"]) {
      expect(get(rows, step), step).toEqual(["none", "none"]);
    }
  });

  it("should reject a step back by the assigned technician and by a manager, and change nothing (CO-F08-S05 AC01)", () => {
    const rows = run(`
      ${booking(10, "in_progress")}
      ${seatIs("in_use")}
      ${changeStatus("tech-back", TECHNICIAN, 10, "assigned")}
      ${changeStatus("ops-back", OPS, 10, "assigned")}
      ${changeStatus("ops-back-far", OPS, 10, "pending")}
      ${state("after", 10)}`);

    expect(get(rows, "tech-back")).toEqual(["42501"]);
    expect(get(rows, "ops-back")).toEqual(["55000"]);
    expect(get(rows, "ops-back-far")).toEqual(["55000"]);
    expect(get(rows, "after")).toEqual(["in_progress", "in_use"]);
  });

  it("should refuse a technician who moves on a stale view and keep the booking where it is (CO-F08-S05 AC01)", () => {
    const rows = run(`
      ${booking(11, "assigned")}
      ${seatIs("reserved")}
      ${move("ops-en-route", OPS, 11, "assigned")}
      ${move("tech-stale", TECHNICIAN, 11, "assigned")}
      ${state("after", 11)}`);

    expect(get(rows, "ops-en-route")).toEqual(["ok"]);
    expect(get(rows, "tech-stale")).toEqual(["BK007", "en_route"]);
    expect(get(rows, "after")).toEqual(["en_route", "reserved"]);
  });

  it("should keep the step change with who made it, when, and the note, and refuse to change or delete it (CO-F08-S06 AC04)", () => {
    const rows = run(`
      ${booking(12, "ready")}
      ${seatIs("available")}
      ${move("assign", OPS, 12, "ready", "'Seat reserved for the family'")}
      do $$ declare e record; begin
        select user_id, notes, created_at, to_status into e from public.booking_events
         where booking_id = '${bookingId(12)}' and to_status = 'assigned';
        raise notice 'R|event|%|%|%', e.user_id is not null, e.notes, e.created_at is not null;
      end $$;
      do $$ begin
        update public.booking_events set notes = 'changed' where booking_id = '${bookingId(12)}';
        raise notice 'R|update|ok';
      exception when others then raise notice 'R|update|%', sqlstate; end $$;
      do $$ begin
        delete from public.booking_events where booking_id = '${bookingId(12)}';
        raise notice 'R|delete|ok';
      exception when others then raise notice 'R|delete|%', sqlstate; end $$;`);

    expect(get(rows, "assign")).toEqual(["ok"]);
    expect(get(rows, "event")).toEqual(["true", "Seat reserved for the family", "true"]);
    expect(get(rows, "update")).toEqual(["55000"]);
    expect(get(rows, "delete")).toEqual(["55000"]);
  });

  it("should release the reserved seat when a booking is cancelled at a field step (CO-F08-S08)", () => {
    const rows = run(`
      ${booking(13, "en_route")}
      ${seatIs("reserved")}
      select set_config('request.jwt.claim.sub', coalesce(${OPS}, ''), true);
      do $$ begin
        perform public.change_booking_status('${bookingId(13)}', 'cancelled', 'Flight cancelled');
        raise notice 'R|cancel|ok';
      exception when others then raise notice 'R|cancel|%', sqlstate; end $$;
      ${state("after", 13)}`);

    expect(get(rows, "cancel")).toEqual(["ok"]);
    expect(get(rows, "after")).toEqual(["cancelled", "available"]);
  });

  it("should move a booking from Family Ready to Active Rental only for the office, and put the seat in use", () => {
    const rows = run(`
      ${booking(14, "family_ready")}
      ${seatIs("reserved")}
      ${move("tech-start", TECHNICIAN, 14, "family_ready")}
      ${move("ops-start", OPS, 14, "family_ready")}
      ${state("after", 14)}`);

    expect(get(rows, "tech-start")[0]).toBe("42501");
    expect(get(rows, "ops-start")).toEqual(["ok"]);
    expect(get(rows, "after")).toEqual(["in_progress", "in_use"]);
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
