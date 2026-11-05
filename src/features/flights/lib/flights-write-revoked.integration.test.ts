import { describe, expect, it } from "vitest";

import { AIRPORT, available, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F02-S14 (AC02, spec E9): the role of the user who saves a flight is taken away while the screen is
 * open. The next write of the open session is refused by the database: a new flight gives `42501` and a
 * change to an existing flight touches no row. The control shows the same user could write before the
 * change. Every scenario runs in a transaction that is rolled back. Skipped when the local stack is not
 * running.
 */
const FLIGHT = "d5400000-0000-0000-0000-0000000000f1";

const SETUP = `
  select set_config('test.ops', (select id::text from public.users u
    where u.role = 'operations_manager' and u.is_active order by u.email limit 1), true);
  select set_config('test.admin', (select id::text from public.users u
    where u.role = 'admin' and u.is_active order by u.email limit 1), true);
  insert into public.flights (id, flight_number, airport_id, scheduled_arrival_at)
  values ('${FLIGHT}', 'RV1', '${AIRPORT}', '2030-01-01 12:00:00+00');`;

// Only an admin may change a role or an active flag (a trigger on users), so the change is made as one.
const AS_ADMIN = `select set_config('request.jwt.claim.sub', current_setting('test.admin'), true);`;
const CHANGE = (set: string) =>
  `${AS_ADMIN} update public.users set ${set} where id = current_setting('test.ops')::uuid;`;
const REVOKE = CHANGE("role = 'technician'");

/** What the next write of the open session of the ops user gets, reported under `name`. */
const nextWrite = (name: string) => `
  set local role authenticated;
  select set_config('request.jwt.claim.sub', current_setting('test.ops'), true);
  do $$ declare n integer; begin
    begin
      insert into public.flights (flight_number, airport_id, scheduled_arrival_at)
      values ('RVX', '${AIRPORT}', '2030-01-01 12:00:00+00');
      raise notice 'R|${name}-insert|ok';
    exception when others then
      raise notice 'R|${name}-insert|%', sqlstate;
    end;
    update public.flights set terminal = 'Z' where id = '${FLIGHT}';
    get diagnostics n = row_count;
    raise notice 'R|${name}-update|%', n;
  end $$;
  reset role;`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("a flight write after the role is revoked (VI-F02-S14)", () => {
  it("should let an operations manager who still holds the role add and change a flight (the control)", () => {
    const rows = run(`${SETUP} ${nextWrite("before")}`);

    expect(get(rows, "before-insert")).toEqual(["ok"]);
    expect(get(rows, "before-update")).toEqual(["1"]);
  });

  it("should refuse a new flight and change no row once the role is taken away", () => {
    const rows = run(`${SETUP} ${REVOKE} ${nextWrite("after")}`);

    expect(get(rows, "after-insert")).toEqual(["42501"]);
    expect(get(rows, "after-update")).toEqual(["0"]);
  });

  it("should refuse the write of a deactivated account the same way", () => {
    const rows = run(
      `${SETUP} ${CHANGE("is_active = false")} ${nextWrite("off")}`,
    );

    expect(get(rows, "off-insert")).toEqual(["42501"]);
    expect(get(rows, "off-update")).toEqual(["0"]);
  });
});
