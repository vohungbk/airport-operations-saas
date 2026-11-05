import { describe, expect, it } from "vitest";

import { AIRPORT, available, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F02-S12 (AC06, spec R4, R13): apply_simulated_flight_change() stores a simulated change like a provider
 * update, and only for an admin. The same call by an operations manager, a technician, a partner user or a
 * signed-in user with no profile is refused with 42501 and changes nothing. Every scenario runs in a transaction
 * that is rolled back and makes its own flight. A user is a demo user of the role: the session role is switched
 * to `authenticated` and `request.jwt.claim.sub` names the user. Skipped when the local stack is not running.
 */
const FLIGHT = "d5400000-0000-0000-0000-0000000000b1";
const VALUES = `'{"status":"delayed","estimated_arrival_at":"2030-01-01T13:00:00Z","actual_arrival_at":null,"terminal":"T1","delay_minutes":60,"provider":"simulator"}'::jsonb`;
const CHANGES = `'[{"field":"delay_minutes","from":0,"to":60}]'::jsonb`;

const demoUser = (role: string) =>
  `(select id::text from public.users u where u.role = '${role}' and u.is_active order by u.email limit 1)`;

const SETUP = `
  select set_config('test.admin', ${demoUser("admin")}, true);
  select set_config('test.operations_manager', ${demoUser("operations_manager")}, true);
  select set_config('test.technician', ${demoUser("technician")}, true);
  select set_config('test.partner_user', ${demoUser("partner_user")}, true);
  select set_config('test.nobody', '00000000-0000-0000-0000-0000000000aa', true);
  insert into public.flights (id, flight_number, airport_id, scheduled_arrival_at, estimated_arrival_at, delay_minutes)
  values ('${FLIGHT}', 'SIM9', '${AIRPORT}', '2030-01-01 12:00:00+00', '2030-01-01 12:00:00+00', 0);`;

/** Calls the function as `user` and reports `R|<name>|<result or sqlstate>`. */
const apply = (name: string, user: string, expected = "null") => `
  set local role authenticated;
  select set_config('request.jwt.claim.sub', current_setting('test.${user}'), true);
  do $$ declare r boolean; begin
    begin
      r := public.apply_simulated_flight_change('${FLIGHT}', ${VALUES}, ${CHANGES}, ${expected});
      raise notice 'R|${name}|%', r;
    exception when others then
      raise notice 'R|${name}|%', sqlstate;
    end;
  end $$;
  reset role;`;

/** The flight and its history as they are now. */
const state = (name: string) => `
  do $$ begin
    raise notice 'R|${name}|%|%|%|%',
      (select status from public.flights where id = '${FLIGHT}'),
      (select delay_minutes from public.flights where id = '${FLIGHT}'),
      (select count(*) from public.flight_updates where flight_id = '${FLIGHT}'),
      (select coalesce(string_agg(source, ','), '') from public.flight_updates where flight_id = '${FLIGHT}');
  end $$;`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("apply_simulated_flight_change (VI-F02-S12)", () => {
  it("should let an admin store the change: the flight is updated and the history keeps one row from the system", () => {
    const rows = run(`${SETUP} ${apply("admin", "admin")} ${state("after")}`);

    expect(get(rows, "admin")).toEqual(["t"]);
    expect(get(rows, "after")).toEqual(["delayed", "60", "1", "system"]);
  });

  it.each(["operations_manager", "technician", "partner_user", "nobody"])(
    "should refuse %s with 42501 and change nothing",
    (user) => {
      const rows = run(`${SETUP} ${apply("call", user)} ${state("after")}`);

      expect(get(rows, "call")).toEqual(["42501"]);
      expect(get(rows, "after")).toEqual(["scheduled", "0", "0", ""]);
    },
  );

  it("should write nothing and return false when the flight was refreshed since it was read", () => {
    const rows = run(
      `${SETUP} update public.flights set last_synced_at = '2030-01-01 11:00:00+00' where id = '${FLIGHT}';
       ${apply("stale", "admin", "'2030-01-01 10:00:00+00'")} ${state("after")}`,
    );

    expect(get(rows, "stale")).toEqual(["f"]);
    expect(get(rows, "after")).toEqual(["scheduled", "0", "0", ""]);
  });

  it("should refuse an admin whose account was deactivated", () => {
    const rows = run(
      `${SETUP} select set_config('request.jwt.claim.sub', current_setting('test.admin'), true);
       update public.users set is_active = false where id = current_setting('test.admin')::uuid;
       ${apply("off", "admin")} ${state("after")}`,
    );

    expect(get(rows, "off")).toEqual(["42501"]);
    expect(get(rows, "after")).toEqual(["scheduled", "0", "0", ""]);
  });
});
