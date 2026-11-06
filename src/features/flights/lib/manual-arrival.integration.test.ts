import { describe, expect, it } from "vitest";

import {
  AIRPORT,
  available,
  bookingId,
  newBooking,
  newPartner,
  run,
} from "@/lib/finance/finance-test-support";

/**
 * VI-F02-S07 (AC01, spec E6, Q4): enter_manual_arrival() stores an arrival entered by hand, only for an admin or
 * an operations manager, with a required reason. The Manual mark stays until the provider answers after it. The
 * same call by a technician or a partner user (another tenant) is refused with 42501 and changes nothing. Every
 * scenario runs in a transaction that is rolled back and makes its own partner, booking and flight. Skipped when
 * the local stack is not running.
 */
const FUTURE = "2030-01-10 12:00:00+00";
const RETURN = "2030-01-14 12:00:00+00";
const flightId = (n: number) => `d5700000-0000-0000-0000-${String(n).padStart(12, "0")}`;

const VALUES = `'{"status":"scheduled","estimated_arrival_at":"2030-01-10T12:40:00Z","actual_arrival_at":null,"terminal":null,"delay_minutes":40,"provider":"manual"}'::jsonb`;
const CHANGES = `'[{"field":"delay_minutes","from":0,"to":40}]'::jsonb`;
const PROVIDER_VALUES = `'{"status":"scheduled","estimated_arrival_at":"2030-01-10T12:10:00Z","actual_arrival_at":null,"terminal":null,"delay_minutes":10,"provider":"provider"}'::jsonb`;

const demoUser = (role: string) =>
  `(select id::text from public.users u where u.role = '${role}' and u.is_active order by u.email limit 1)`;

const USERS = `
  select set_config('test.operations_manager', ${demoUser("operations_manager")}, true);
  select set_config('test.technician', ${demoUser("technician")}, true);
  select set_config('test.partner_user', ${demoUser("partner_user")}, true);`;

/** A booking `n` with a number, linked to a flight due at 12:00 (or with no flight, as the provider did not know it). */
const booking = (n: number, linked: boolean) => `
  ${newPartner(n)}
  ${newBooking(n, n, RETURN, "90", FUTURE)}
  update public.bookings set flight_number = 'MN${n}'
    ${linked ? "" : ", flight_lookup_status = 'not_found'"} where id = '${bookingId(n)}';
  ${
    linked
      ? `insert into public.flights (id, flight_number, airport_id, scheduled_arrival_at, estimated_arrival_at, delay_minutes)
         values ('${flightId(n)}', 'MN${n}', '${AIRPORT}', '2030-01-10 12:00:00+00', '2030-01-10 12:00:00+00', 0);
         update public.bookings set flight_id = '${flightId(n)}', flight_lookup_status = 'linked' where id = '${bookingId(n)}';`
      : ""
  }`;

/** Calls the function as `user` and reports `R|<name>|ok, null or the sqlstate`. */
const enter = (name: string, user: string, n: number, reason = "'Passenger called'", scheduled = "null") => `
  set local role authenticated;
  select set_config('request.jwt.claim.sub', current_setting('test.${user}'), true);
  do $$ declare r uuid; begin
    begin
      r := public.enter_manual_arrival('${bookingId(n)}', ${VALUES}, ${CHANGES}, ${reason}, ${scheduled});
      raise notice 'R|${name}|%', case when r is null then 'null' else 'ok' end;
    exception when others then
      raise notice 'R|${name}|%', sqlstate;
    end;
  end $$;
  reset role;`;

/** The mark, the reason and the history of the flight of booking `n`. */
const state = (name: string, n: number) => `
  do $$ declare f uuid; begin
    select flight_id into f from public.bookings where id = '${bookingId(n)}';
    raise notice 'R|${name}|%|%|%|%',
      coalesce((select (manual_entered_at is not null)::text from public.flights where id = f), 'noflight'),
      coalesce((select manual_reason from public.flights where id = f), ''),
      (select count(*) from public.flight_updates where flight_id = f),
      coalesce((select string_agg(source || ':' || coalesce(reason, ''), ',' order by occurred_at, source) from public.flight_updates where flight_id = f), '');
  end $$;`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("enter_manual_arrival (VI-F02-S07)", () => {
  it("should let an operations manager enter an arrival: the flight is marked Manual and the history keeps the reason", () => {
    const rows = run(`${USERS} ${booking(1, true)} ${enter("call", "operations_manager", 1)} ${state("after", 1)}`);

    expect(get(rows, "call")).toEqual(["ok"]);
    expect(get(rows, "after")).toEqual(["true", "Passenger called", "1", "manual:Passenger called"]);
  });

  it("should refuse an empty reason with 22023 and change nothing", () => {
    const rows = run(`${USERS} ${booking(2, true)} ${enter("call", "operations_manager", 2, "'   '")} ${state("after", 2)}`);

    expect(get(rows, "call")).toEqual(["22023"]);
    expect(get(rows, "after")).toEqual(["false", "", "0", ""]);
  });

  it.each(["technician", "partner_user"])("should refuse %s with 42501 and change nothing", (user) => {
    const rows = run(`${USERS} ${booking(3, true)} ${enter("call", user, 3)} ${state("after", 3)}`);

    expect(get(rows, "call")).toEqual(["42501"]);
    expect(get(rows, "after")).toEqual(["false", "", "0", ""]);
  });

  it("should make and link the flight when the provider did not know the number", () => {
    const rows = run(`${USERS} ${booking(4, false)}
      ${enter("call", "operations_manager", 4, "'No data'", "'2030-01-10 12:00:00+00'")} ${state("after", 4)}
      do $$ begin raise notice 'R|lookup|%', (select flight_lookup_status from public.bookings where id = '${bookingId(4)}'); end $$;`);

    expect(get(rows, "call")).toEqual(["ok"]);
    expect(get(rows, "after")).toEqual(["true", "No data", "1", "manual:No data"]);
    expect(get(rows, "lookup")).toEqual(["linked"]);
  });

  it("should refuse a booking with no flight when no scheduled arrival is given", () => {
    const rows = run(`${USERS} ${booking(5, false)} ${enter("call", "operations_manager", 5)} ${state("after", 5)}`);

    expect(get(rows, "call")).toEqual(["22023"]);
    expect(get(rows, "after")).toEqual(["noflight", "", "0", ""]);
  });

  it("should clear the Manual mark when the provider answers after the entry and keep both rows in the history", () => {
    const rows = run(`${USERS} ${booking(7, true)} ${enter("call", "operations_manager", 7)}
      select public.apply_flight_refresh('${flightId(7)}', ${PROVIDER_VALUES},
        '[{"field":"delay_minutes","from":40,"to":10}]'::jsonb, 'provider',
        (select last_synced_at from public.flights where id = '${flightId(7)}'));
      ${state("after", 7)}`);

    expect(get(rows, "after")).toEqual(["false", "", "2", "manual:Passenger called,provider:"]);
  });
});
