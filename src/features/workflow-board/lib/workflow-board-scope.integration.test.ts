import { describe, expect, it } from "vitest";

import { AIRPORT, CATEGORY, PARTNER, available, bookingId, run } from "@/lib/finance/finance-test-support";

/**
 * CO-F08-S09 (spec R10, E7): the workflow data a person can read is within their scope. It reads what the
 * Workflow Board and the booking workflow page read (the bookings, their step history and the time in
 * step) with the real RLS of each role, in a transaction that is rolled back. Booking 1 belongs to the
 * first seed partner and is assigned to the first technician; booking 2 belongs to the second seed
 * partner and has no technician. Needs the demo users of every role (present after `npm run demo:reset`).
 * Skipped when the local stack is not running.
 */
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";
const START = "2030-01-01 10:00:00+00";
const RETURN = "2030-01-04 10:00:00+00";

const USER_OF = (name: string, role: string, partner: string | null, offset = 0) => `
  select set_config('t.${name}', coalesce(
    (select id::text from public.users u where u.role = '${role}' and u.is_active
       ${partner ? `and u.partner_id = '${partner}'` : ""} order by u.email limit 1 offset ${offset}), ''), true);`;

const newBooking = (n: number, partner: string, technician: string | null) => `
  insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate, assigned_technician_id)
  values ('${bookingId(n)}', 'SC-${n}', '${partner}', '${AIRPORT}', '${START}', '${RETURN}', '${CATEGORY}', 90,
          ${technician ? `current_setting('t.${technician}')::uuid` : "null"});`;

/** Reports `R|name|<bookings>|<events>|<with a step time>` for the two bookings, read as the given user. */
const readAs = (name: string, key: string | null) => `
  select set_config('request.jwt.claim.sub', ${key ? `current_setting('t.${key}')` : "''"}, true);
  do $$ declare n_bookings integer; n_events integer; n_since integer; begin
    select count(*), count(public.board_step_since(b)) into n_bookings, n_since
      from public.bookings b where b.id in ('${bookingId(1)}', '${bookingId(2)}');
    select count(*) into n_events
      from public.booking_events e where e.booking_id in ('${bookingId(1)}', '${bookingId(2)}');
    raise notice 'R|${name}|%|%|%', n_bookings, n_events, n_since;
  end $$;`;

/** Reports `R|name|<rows>` for a lookup of booking 1 by its id, the way the workflow page opens it. */
const openAs = (name: string, key: string) => `
  select set_config('request.jwt.claim.sub', current_setting('t.${key}'), true);
  do $$ declare n_booking integer; n_events integer; begin
    select count(*) into n_booking from public.bookings where id = '${bookingId(1)}';
    select count(*) into n_events from public.booking_events where booking_id = '${bookingId(1)}';
    raise notice 'R|${name}|%|%', n_booking, n_events;
  end $$;`;

describe.skipIf(!available)("who can read workflow data (CO-F08-S09, spec R10, E7)", () => {
  const rows = available
    ? run(`
        ${USER_OF("admin", "admin", null)}
        ${USER_OF("ops", "operations_manager", null)}
        ${USER_OF("owner", "partner_user", PARTNER)}
        ${USER_OF("other", "partner_user", OTHER_PARTNER)}
        ${USER_OF("tech", "technician", null)}
        ${USER_OF("tech2", "technician", null, 1)}
        do $$ begin
          raise notice 'R|have|%|%|%|%|%|%', current_setting('t.admin') <> '', current_setting('t.ops') <> '',
            current_setting('t.owner') <> '', current_setting('t.other') <> '', current_setting('t.tech') <> '',
            current_setting('t.tech2') <> '';
        end $$;
        ${newBooking(1, PARTNER, "tech")}
        ${newBooking(2, OTHER_PARTNER, null)}
        set local role authenticated;
        ${readAs("admin", "admin")}
        ${readAs("ops", "ops")}
        ${readAs("owner", "owner")}
        ${readAs("other", "other")}
        ${readAs("tech", "tech")}
        ${readAs("tech2", "tech2")}
        ${readAs("anon", null)}
        ${openAs("open_other", "other")}`)
    : [];

  const get = (name: string) => rows.find((r) => r[0] === name)?.slice(1);

  it("should have the users it needs: both internal roles, a partner user of each partner, two technicians", () => {
    expect(get("have")).toEqual(["t", "t", "t", "t", "t", "t"]);
  });

  it("should show an admin and an operations manager every booking with its history (AC01)", () => {
    expect(get("admin")).toEqual(["2", "2", "2"]);
    expect(get("ops")).toEqual(["2", "2", "2"]);
  });

  it("should show a partner user only the bookings of its own partner, with their history (AC01)", () => {
    expect(get("owner")).toEqual(["1", "1", "1"]);
    expect(get("other")).toEqual(["1", "1", "1"]);
  });

  it("should show the assigned technician only the booking assigned to them (AC01)", () => {
    expect(get("tech")).toEqual(["1", "1", "1"]);
  });

  it("should show a technician who is not assigned nothing (AC01)", () => {
    expect(get("tech2")).toEqual(["0", "0", "0"]);
  });

  it("should show a caller with no user identity nothing (AC01)", () => {
    expect(get("anon")).toEqual(["0", "0", "0"]);
  });

  it("should show a partner user of another partner no booking and no history when it opens the booking by its id (AC02, cross-tenant denial)", () => {
    expect(get("open_other")).toEqual(["0", "0"]);
  });
});
