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
 * VI-F02-S03 (AC02, spec R13, R15): flight_updates keeps the changes of a flight with their time and
 * source, nobody can change or delete a row, who may read a row follows who may see the flight, and
 * apply_flight_refresh() is for the system only. Every scenario runs in a transaction that is rolled
 * back and makes its own flights, partners and bookings. A user is a demo user of the role: the
 * session role is switched to `authenticated` and `request.jwt.claim.sub` names the user, as the
 * other database suites do. Skipped when the local stack is not running.
 */
const flightId = (n: number) => `d5300000-0000-0000-0000-${String(n).padStart(12, "0")}`;

const PARTNER_USER =
  "(select id::text from public.users u where u.role = 'partner_user' and u.is_active and u.partner_id is not null order by u.email limit 1)";
const TECHNICIAN =
  "(select id::text from public.users u where u.role = 'technician' and u.is_active order by u.email limit 1)";
const OPS =
  "(select id::text from public.users u where u.role = 'operations_manager' and u.is_active order by u.email limit 1)";

const CHANGES = `'[{"field":"terminal","from":"1","to":"3"}]'::jsonb`;

const flight = (n: number) =>
  `insert into public.flights (id, flight_number, airport_id, scheduled_arrival_at)
   values ('${flightId(n)}', 'RF${n}', '${AIRPORT}', '2030-01-01 12:00:00+00');`;

const history = (n: number, source = "provider") =>
  `insert into public.flight_updates (flight_id, source, changes) values ('${flightId(n)}', '${source}', ${CHANGES});`;

/** A booking on a flight, of a partner (a SQL expression) and with a technician (a SQL expression or null). */
const bookingOn = (n: number, partner: string, flightN: number, technician = "null") =>
  `insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate, flight_id, assigned_technician_id)
   values ('${bookingId(n)}', 'FU-${n}', ${partner}, '${AIRPORT}', '2030-01-01 10:00:00+00', '2030-01-04 10:00:00+00', '${CATEGORY}', 90, '${flightId(flightN)}', ${technician});`;

/**
 * Two flights with one history row each. Flight 1 is on a booking of the partner of the demo partner user,
 * with no technician. Flight 2 is on a booking of another partner, assigned to the demo technician.
 */
const SETUP = `
  select set_config('test.partner_user', ${PARTNER_USER}, true);
  select set_config('test.technician', ${TECHNICIAN}, true);
  select set_config('test.ops', ${OPS}, true);
  ${newPartner(91)}
  ${flight(1)}
  ${flight(2)}
  ${history(1)}
  ${history(2, "system")}
  ${bookingOn(1, "(select partner_id from public.users where id = current_setting('test.partner_user')::uuid)", 1)}
  ${bookingOn(2, `'${partnerId(91)}'`, 2, "current_setting('test.technician')::uuid")}`;

/** How many history rows of a flight the user (a setting made in SETUP) can read, as `R|name|count`. */
const readAs = (name: string, user: string, flightN: number) => `
  set local role authenticated;
  select set_config('request.jwt.claim.sub', current_setting('test.${user}'), true);
  do $$ begin
    raise notice 'R|${name}|%', (select count(*) from public.flight_updates where flight_id = '${flightId(flightN)}');
  end $$;
  reset role;`;

/** Runs a statement and reports `R|name|ok` or `R|name|<sqlstate>`. */
const attempt = (name: string, statement: string) => `
  do $$ begin
    ${statement}
    raise notice 'R|${name}|ok';
  exception when others then
    raise notice 'R|${name}|%', sqlstate;
  end $$;`;

const APPLY = (flightN: number, source = "provider", changes = CHANGES, expected = "null") =>
  `perform public.apply_flight_refresh('${flightId(flightN)}',
     '{"status":"delayed","estimated_arrival_at":"2030-01-01T12:40:00Z","actual_arrival_at":null,"terminal":"2","delay_minutes":40,"provider":"provider"}'::jsonb,
     ${changes}, '${source}', ${expected});`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("flight update history (VI-F02-S03)", () => {
  describe("who may read it (spec R15)", () => {
    it("should let an operations manager read the history of every flight", () => {
      const rows = run(`${SETUP} ${readAs("f1", "ops", 1)} ${readAs("f2", "ops", 2)}`);

      expect(get(rows, "f1")).toEqual(["1"]);
      expect(get(rows, "f2")).toEqual(["1"]);
    });

    it("should let a partner user read the history of its own bookings' flights and not another partner's", () => {
      const rows = run(`${SETUP} ${readAs("own", "partner_user", 1)} ${readAs("other", "partner_user", 2)}`);

      expect(get(rows, "own")).toEqual(["1"]);
      expect(get(rows, "other")).toEqual(["0"]);
    });

    it("should let a technician read the history of the flight of an assigned booking and not of another", () => {
      const rows = run(`${SETUP} ${readAs("assigned", "technician", 2)} ${readAs("other", "technician", 1)}`);

      expect(get(rows, "assigned")).toEqual(["1"]);
      expect(get(rows, "other")).toEqual(["0"]);
    });
  });

  describe("history is not changed or deleted (AC02, spec R13)", () => {
    it("should refuse to update or delete a row, even for the owner of the table", () => {
      const rows = run(`${SETUP}
        ${attempt("update", `update public.flight_updates set source = 'system' where flight_id = '${flightId(1)}';`)}
        ${attempt("delete", `delete from public.flight_updates where flight_id = '${flightId(1)}';`)}
        ${attempt("truncate", "truncate public.flight_updates;")}`);

      expect(get(rows, "update")).toEqual(["55000"]);
      expect(get(rows, "delete")).toEqual(["55000"]);
      expect(get(rows, "truncate")).toEqual(["55000"]);
    });

    it("should not let a signed-in user write a row, an operations manager included", () => {
      const rows = run(`${SETUP}
        set local role authenticated;
        select set_config('request.jwt.claim.sub', current_setting('test.ops'), true);
        ${attempt("insert", `insert into public.flight_updates (flight_id, source, changes) values ('${flightId(1)}', 'manual', ${CHANGES});`)}
        reset role;`);

      expect(get(rows, "insert")).toEqual(["42501"]);
    });

    it("should refuse a source that is not provider, system or manual, and an empty list of changes", () => {
      const rows = run(`${SETUP}
        ${attempt("source", `insert into public.flight_updates (flight_id, source, changes) values ('${flightId(1)}', 'guess', ${CHANGES});`)}
        ${attempt("empty", `insert into public.flight_updates (flight_id, source, changes) values ('${flightId(1)}', 'provider', '[]'::jsonb);`)}`);

      expect(get(rows, "source")).toEqual(["23514"]);
      expect(get(rows, "empty")).toEqual(["23514"]);
    });
  });

  describe("apply_flight_refresh (AC01, AC02)", () => {
    it("should store the new values and the sync time, and keep what changed with its source", () => {
      const rows = run(`${SETUP}
        ${attempt("apply", APPLY(1, "provider"))}
        do $$ declare f record; n integer; begin
          select * into f from public.flights where id = '${flightId(1)}';
          select count(*) into n from public.flight_updates where flight_id = f.id and source = 'provider';
          raise notice 'R|state|%|%|%|%|%', f.status, f.terminal, f.delay_minutes, f.last_synced_at is not null, n;
        end $$;`);

      expect(get(rows, "apply")).toEqual(["ok"]);
      expect(get(rows, "state")).toEqual(["delayed", "2", "40", "true", "2"]);
    });

    it("should store the values and write no history row when nothing changed", () => {
      const rows = run(`${SETUP}
        ${attempt("apply", APPLY(1, "provider", "'[]'::jsonb"))}
        do $$ declare n integer; begin
          select count(*) into n from public.flight_updates where flight_id = '${flightId(1)}';
          raise notice 'R|rows|%', n;
        end $$;`);

      expect(get(rows, "apply")).toEqual(["ok"]);
      expect(get(rows, "rows")).toEqual(["1"]);
    });

    it("should write nothing and say so when another run refreshed the flight since it was read", () => {
      const rows = run(`${SETUP}
        do $$ declare stored boolean; n integer; begin
          update public.flights set last_synced_at = '2030-01-01 11:00:00+00' where id = '${flightId(1)}';
          stored := public.apply_flight_refresh('${flightId(1)}', '{"status":"delayed","terminal":"2","provider":"provider"}'::jsonb,
            ${CHANGES}, 'provider', '2030-01-01 10:00:00+00'::timestamptz);
          select count(*) into n from public.flight_updates where flight_id = '${flightId(1)}';
          raise notice 'R|overtaken|%|%', stored, n;
        end $$;`);

      expect(get(rows, "overtaken")).toEqual(["false", "1"]);
    });

    it("should refuse a flight that does not exist and a source that is not allowed", () => {
      const rows = run(`${SETUP}
        ${attempt("missing", APPLY(99))}
        ${attempt("source", APPLY(1, "guess"))}`);

      expect(get(rows, "missing")).toEqual(["P0002"]);
      expect(get(rows, "source")).toEqual(["22023"]);
    });

    it("should not be callable by a signed-in user or an anonymous caller, only by the service role", () => {
      const rows = run(`${SETUP}
        do $$ begin
          raise notice 'R|grants|%|%|%',
            has_function_privilege('authenticated', 'public.apply_flight_refresh(uuid, jsonb, jsonb, text, timestamptz)', 'execute'),
            has_function_privilege('anon', 'public.apply_flight_refresh(uuid, jsonb, jsonb, text, timestamptz)', 'execute'),
            has_function_privilege('service_role', 'public.apply_flight_refresh(uuid, jsonb, jsonb, text, timestamptz)', 'execute');
        end $$;`);

      expect(get(rows, "grants")).toEqual(["false", "false", "true"]);
    });
  });
});
