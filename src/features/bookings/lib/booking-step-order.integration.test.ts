import { describe, expect, it } from "vitest";

import {
  FLAG_ON,
  available,
  bookingId,
  newBooking,
  newPartner,
  run,
} from "@/lib/finance/finance-test-support";

/**
 * CO-F08-S02 (AC01, AC02, AC03): the database lets the status of a booking move only to the next
 * step, or leave the path as the booking functions allow. The trigger holds for every client role
 * and every writer, so these updates run as `service_role` (which skips row-level security, so
 * the trigger is what answers); the owner role is exempt, as the seed and the finance tests need.
 * Every scenario runs in a transaction that is rolled back and makes its own partner and bookings.
 * Skipped when the local stack is not running, like the RLS suite.
 */
const START = "2030-01-01 10:00:00+00";
const RETURN = "2030-01-04 10:00:00+00";

/** Tries a status change and reports `R|name|ok` or `R|name|<sqlstate>`. */
const attempt = (name: string, n: number, status: string) => `
  do $$ begin
    update public.bookings set status = '${status}' where id = '${bookingId(n)}';
    raise notice 'R|${name}|ok';
  exception when others then
    raise notice 'R|${name}|%', sqlstate;
  end $$;`;

const result = (rows: string[][], name: string) => rows.find((row) => row[0] === name)?.[1];

const AS_CLIENT = `${FLAG_ON} set local role service_role;`;

describe.skipIf(!available)("booking step order (CO-F08-S02)", () => {
  it("should start a booking at the first step, New (AC01)", () => {
    const rows = run(`
      ${newPartner(1)}
      ${newBooking(1, 1, RETURN, "90", START)}
      do $$ declare b record; begin
        select status into b from public.bookings where id = '${bookingId(1)}';
        raise notice 'R|start|%', b.status;
      end $$;`);

    expect(result(rows, "start")).toBe("pending");
  });

  it("should move a booking one step at a time along the path (AC01)", () => {
    const rows = run(`
      ${newPartner(2)}
      ${newBooking(2, 2, RETURN, "90", START)}
      ${AS_CLIENT}
      ${attempt("confirm", 2, "confirmed")}
      ${attempt("assign", 2, "assigned")}
      ${attempt("start", 2, "in_progress")}`);

    expect(["confirm", "assign", "start"].map((name) => result(rows, name))).toEqual(["ok", "ok", "ok"]);
  });

  it("should reject a skipped step with the invalid-state code (AC02, AC03)", () => {
    const rows = run(`
      ${newPartner(3)}
      ${newBooking(3, 3, RETURN, "90", START)}
      ${AS_CLIENT}
      ${attempt("pending-to-completed", 3, "completed")}
      ${attempt("pending-to-assigned", 3, "assigned")}
      ${attempt("confirm", 3, "confirmed")}
      ${attempt("confirmed-to-in-progress", 3, "in_progress")}`);

    expect(result(rows, "pending-to-completed")).toBe("55000");
    expect(result(rows, "pending-to-assigned")).toBe("55000");
    expect(result(rows, "confirm")).toBe("ok");
    expect(result(rows, "confirmed-to-in-progress")).toBe("55000");
  });

  it("should reject a step back, and let a booking be cancelled at a step after confirmed (AC02)", () => {
    const rows = run(`
      ${newPartner(4)}
      ${newBooking(4, 4, RETURN, "90", START)}
      ${AS_CLIENT}
      ${attempt("confirm", 4, "confirmed")}
      ${attempt("assign", 4, "assigned")}
      ${attempt("back", 4, "pending")}
      ${attempt("cancel-assigned", 4, "cancelled")}`);

    expect(result(rows, "assign")).toBe("ok");
    expect(result(rows, "back")).toBe("55000");
    expect(result(rows, "cancel-assigned")).toBe("ok");
  });

  it("should let a booking be cancelled at in_progress as well (CO-F08-S08 AC01)", () => {
    const rows = run(`
      ${newPartner(8)}
      ${newBooking(8, 8, RETURN, "90", START)}
      ${AS_CLIENT}
      ${attempt("confirm", 8, "confirmed")}
      ${attempt("assign", 8, "assigned")}
      ${attempt("start", 8, "in_progress")}
      ${attempt("cancel-in-progress", 8, "cancelled")}`);

    expect(result(rows, "start")).toBe("ok");
    expect(result(rows, "cancel-in-progress")).toBe("ok");
  });

  it("should let a booking leave the path as the booking functions allow, and never come back (AC01, AC02)", () => {
    const rows = run(`
      ${newPartner(5)}
      ${newBooking(5, 5, RETURN, "90", START)}
      ${newBooking(6, 5, RETURN, "90", START)}
      ${AS_CLIENT}
      ${attempt("cancel", 5, "cancelled")}
      ${attempt("cancelled-to-pending", 5, "pending")}
      ${attempt("confirm", 6, "confirmed")}
      ${attempt("no-show", 6, "no_show")}
      ${attempt("no-show-to-confirmed", 6, "confirmed")}`);

    expect(result(rows, "cancel")).toBe("ok");
    expect(result(rows, "cancelled-to-pending")).toBe("55000");
    expect(result(rows, "no-show")).toBe("ok");
    expect(result(rows, "no-show-to-confirmed")).toBe("55000");
  });

  it("should leave the owner role exempt, as the seed and the migrations run as the owner (spec E6)", () => {
    const rows = run(`
      ${newPartner(7)}
      ${newBooking(7, 7, RETURN, "90", START)}
      ${FLAG_ON}
      ${attempt("owner-skip", 7, "confirmed")}
      ${attempt("owner-skip-again", 7, "in_progress")}`);

    expect(result(rows, "owner-skip")).toBe("ok");
    expect(result(rows, "owner-skip-again")).toBe("ok");
  });
});
