import { describe, expect, it } from "vitest";

import {
  AIRPORT,
  CATEGORY,
  available,
  bookingId,
  newPartner,
  partnerId,
  run,
} from "@/lib/finance/finance-test-support";

/**
 * VI-F02-S13 (AC01, AC02, spec R15, E7): who may read a flight. Internal roles read every flight, a
 * partner user the flights of its own partner's bookings, a technician the flights of the bookings it
 * is assigned to or has a job on. A flight nobody may see is not an error: the read gives no row, so
 * another partner's flight is "not found". Every scenario runs in a transaction that is rolled back
 * and makes its own flights, partners and bookings. A user is a demo user of the role: the session
 * role is switched to `authenticated` and `request.jwt.claim.sub` names the user, as the other
 * database suites do. Skipped when the local stack is not running.
 */
const flightId = (n: number) => `d5400000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const FLIGHTS = [1, 2, 3, 4];

const demoUser = (role: string, extra = "") =>
  `(select id::text from public.users u where u.role = '${role}' and u.is_active ${extra} order by u.email limit 1)`;

/** A signed-in user that has no row in `users`, so no partner and no booking. */
const NOBODY = "'00000000-0000-0000-0000-0000000000aa'";

const flight = (n: number) =>
  `insert into public.flights (id, flight_number, airport_id, scheduled_arrival_at)
   values ('${flightId(n)}', 'RF${n}', '${AIRPORT}', '2030-01-01 12:00:00+00');`;

const bookingOn = (n: number, partner: string, flightN: number, technician = "null") =>
  `insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate, flight_id, assigned_technician_id)
   values ('${bookingId(n)}', 'FA-${n}', ${partner}, '${AIRPORT}', '2030-01-01 10:00:00+00', '2030-01-04 10:00:00+00', '${CATEGORY}', 90, '${flightId(flightN)}', ${technician});`;

/**
 * Four flights, each on a booking:
 *   flight 1: a booking of the partner of the demo partner user.
 *   flight 2: a booking of another partner, assigned to the demo technician, and also a second booking
 *             of the partner of the demo partner user (the flight is shared).
 *   flight 3: a booking of another partner, with a job of the demo technician (not assigned on the booking).
 *   flight 4: a booking of another partner that nobody of these roles has to do with.
 */
const SETUP = `
  select set_config('test.partner_user', ${demoUser("partner_user", "and u.partner_id is not null")}, true);
  select set_config('test.technician', ${demoUser("technician")}, true);
  select set_config('test.ops', ${demoUser("operations_manager")}, true);
  select set_config('test.admin', ${demoUser("admin")}, true);
  select set_config('test.nobody', ${NOBODY}, true);
  ${newPartner(91)}
  ${newPartner(92)}
  ${newPartner(93)}
  ${FLIGHTS.map(flight).join("\n  ")}
  ${bookingOn(1, "(select partner_id from public.users where id = current_setting('test.partner_user')::uuid)", 1)}
  ${bookingOn(2, `'${partnerId(91)}'`, 2, "current_setting('test.technician')::uuid")}
  ${bookingOn(3, `'${partnerId(92)}'`, 3)}
  ${bookingOn(4, `'${partnerId(93)}'`, 4)}
  ${bookingOn(5, "(select partner_id from public.users where id = current_setting('test.partner_user')::uuid)", 2)}
  insert into public.technician_jobs (booking_id, technician_id, job_type, status)
  values ('${bookingId(3)}', current_setting('test.technician')::uuid, 'installation', 'assigned');`;

/** Runs `statements` as the user named by a setting of SETUP (the session role is `authenticated`). */
const asUser = (user: string, statements: string) => `
  set local role authenticated;
  select set_config('request.jwt.claim.sub', current_setting('test.${user}'), true);
  ${statements}
  reset role;`;

/** Reports `R|name|<numbers of the test flights the user can read>`, for example `1,2`. */
const visibleFlights = (name: string, user: string) =>
  asUser(
    user,
    `do $$ begin
       raise notice 'R|${name}|%', (
         select coalesce(string_agg(right(f.id::text, 1), ',' order by f.id), '')
           from public.flights f where f.id in (${FLIGHTS.map((n) => `'${flightId(n)}'`).join(", ")}));
     end $$;`,
  );

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("who may read a flight (VI-F02-S13)", () => {
  describe("AC01", () => {
    it("should let an admin and an operations manager read every flight", () => {
      const rows = run(`${SETUP} ${visibleFlights("ops", "ops")} ${visibleFlights("admin", "admin")}`);

      expect(get(rows, "ops")).toEqual(["1,2,3,4"]);
      expect(get(rows, "admin")).toEqual(["1,2,3,4"]);
    });

    it("should let a partner user read only the flights of its own partner's bookings", () => {
      const rows = run(`${SETUP} ${visibleFlights("partner", "partner_user")}`);

      expect(get(rows, "partner")).toEqual(["1,2"]);
    });

    it("should let a technician read only the flights of the bookings it is assigned to or has a job on", () => {
      const rows = run(`${SETUP} ${visibleFlights("technician", "technician")}`);

      expect(get(rows, "technician")).toEqual(["2,3"]);
    });

    it("should show a flight that two partners share to both, and nothing of the other partner's booking", () => {
      const rows = run(`${SETUP}
        ${asUser(
          "partner_user",
          `do $$ begin
             raise notice 'R|shared|%|%',
               (select count(*) from public.flights where id = '${flightId(2)}'),
               (select count(*) from public.bookings where id = '${bookingId(2)}');
           end $$;`,
        )}`);

      expect(get(rows, "shared")).toEqual(["1", "0"]);
    });
  });

  describe("AC02", () => {
    it("should give a partner user no row, not an error, when it asks for another partner's flight by id or by number", () => {
      const rows = run(`${SETUP}
        ${asUser(
          "partner_user",
          `do $$ declare byId integer; byNumber integer; viaBooking integer; begin
             select count(*) into byId from public.flights where id = '${flightId(4)}';
             select count(*) into byNumber from public.flights where flight_number = 'RF4';
             select count(*) into viaBooking from public.bookings b
               join public.flights f on f.id = b.flight_id where b.id = '${bookingId(4)}';
             raise notice 'R|other|%|%|%', byId, byNumber, viaBooking;
           end $$;`,
        )}`);

      expect(get(rows, "other")).toEqual(["0", "0", "0"]);
    });

    it("should give a technician who is not on the booking no row of its flight", () => {
      const rows = run(`${SETUP}
        ${asUser(
          "technician",
          `do $$ begin
             raise notice 'R|other|%', (select count(*) from public.flights where id = '${flightId(4)}');
           end $$;`,
        )}`);

      expect(get(rows, "other")).toEqual(["0"]);
    });

    it("should give a signed-in user with no partner and no booking no flight at all", () => {
      const rows = run(`${SETUP} ${visibleFlights("nobody", "nobody")}`);

      expect(get(rows, "nobody")).toEqual([""]);
    });
  });

  describe("writes are not widened", () => {
    it("should not let a partner user or a technician add or change a flight", () => {
      const write = (name: string, user: string) =>
        asUser(
          user,
          `do $$ declare n integer; begin
             begin
               insert into public.flights (flight_number, airport_id, scheduled_arrival_at)
               values ('RFX', '${AIRPORT}', '2030-01-01 12:00:00+00');
               raise notice 'R|${name}-insert|ok';
             exception when others then
               raise notice 'R|${name}-insert|%', sqlstate;
             end;
             update public.flights set terminal = 'Z' where id = '${flightId(1)}';
             get diagnostics n = row_count;
             raise notice 'R|${name}-update|%', n;
           end $$;`,
        );

      const rows = run(`${SETUP} ${write("partner", "partner_user")} ${write("technician", "technician")}`);

      expect(get(rows, "partner-insert")).toEqual(["42501"]);
      expect(get(rows, "partner-update")).toEqual(["0"]);
      expect(get(rows, "technician-insert")).toEqual(["42501"]);
      expect(get(rows, "technician-update")).toEqual(["0"]);
    });
  });
});
