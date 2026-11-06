import { describe, expect, it } from "vitest";

import { AIRPORT, available, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F02-S11 (AC01, spec R12): the last error of a flight source is kept for the provider settings page.
 * Only an admin reads it, nobody signed in writes it, and recording it changes no flight and no booking.
 * Every scenario runs in a transaction that is rolled back. A user is a demo user of the role: the session
 * role is switched to `authenticated` and `request.jwt.claim.sub` names the user, as the other database
 * suites do. Skipped when the local stack is not running.
 */
const FLIGHT = "d5300000-0000-0000-0000-000000000901";

const userOf = (role: string) =>
  `(select id::text from public.users u where u.role = '${role}' and u.is_active order by u.email limit 1)`;

const SETUP = `
  select set_config('test.admin', ${userOf("admin")}, true);
  select set_config('test.ops', ${userOf("operations_manager")}, true);
  select set_config('test.partner_user', ${userOf("partner_user")}, true);
  select set_config('test.technician', ${userOf("technician")}, true);
  insert into public.flights (id, flight_number, airport_id, scheduled_arrival_at, last_synced_at)
  values ('${FLIGHT}', 'RF901', '${AIRPORT}', '2030-01-01 12:00:00+00', '2030-01-01 09:00:00+00');`;

const RECORD = (source = "provider", kind = "rate_limited") =>
  `perform public.record_flight_provider_error('${source}', '${kind}');`;

/** Runs a statement and reports `R|name|ok` or `R|name|<sqlstate>`. */
const attempt = (name: string, statement: string) => `
  do $$ begin
    ${statement}
    raise notice 'R|${name}|ok';
  exception when others then
    raise notice 'R|${name}|%', sqlstate;
  end $$;`;

/** How many rows of the status table the user (a setting made in SETUP) can read, as `R|name|count`. */
const readAs = (name: string, user: string) => `
  set local role authenticated;
  select set_config('request.jwt.claim.sub', current_setting('test.${user}'), true);
  do $$ begin
    raise notice 'R|${name}|%', (select count(*) from public.flight_provider_status);
  end $$;
  reset role;`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("flight provider errors (VI-F02-S11)", () => {
  describe("who may read the last error", () => {
    it("should let an admin read it", () => {
      const rows = run(`${SETUP} select public.record_flight_provider_error('provider', 'rate_limited'); ${readAs("admin", "admin")}`);

      expect(get(rows, "admin")).toEqual(["1"]);
    });

    it.each(["ops", "partner_user", "technician"])("should show %s no error", (user) => {
      const rows = run(
        `${SETUP} select public.record_flight_provider_error('provider', 'timeout'); ${readAs("denied", user)}`,
      );

      expect(get(rows, "denied")).toEqual(["0"]);
    });
  });

  describe("who may write it", () => {
    it("should not let a signed-in user write a row, an admin included", () => {
      const rows = run(`${SETUP}
        set local role authenticated;
        select set_config('request.jwt.claim.sub', current_setting('test.admin'), true);
        ${attempt("insert", "insert into public.flight_provider_status (source, last_error_kind) values ('provider', 'timeout');")}
        reset role;`);

      expect(get(rows, "insert")).toEqual(["42501"]);
    });

    it("should be callable by the service role only", () => {
      const rows = run(`${SETUP}
        do $$ begin
          raise notice 'R|grants|%|%|%',
            has_function_privilege('authenticated', 'public.record_flight_provider_error(text, text)', 'execute'),
            has_function_privilege('anon', 'public.record_flight_provider_error(text, text)', 'execute'),
            has_function_privilege('service_role', 'public.record_flight_provider_error(text, text)', 'execute');
        end $$;`);

      expect(get(rows, "grants")).toEqual(["false", "false", "true"]);
    });
  });

  describe("record_flight_provider_error", () => {
    it("should keep only the last error of a source", () => {
      const rows = run(`${SETUP}
        ${attempt("first", RECORD("provider", "timeout"))}
        ${attempt("second", RECORD("provider", "rate_limited"))}
        do $$ declare n integer; k text; begin
          select count(*), max(last_error_kind) into n, k from public.flight_provider_status where source = 'provider';
          raise notice 'R|state|%|%', n, k;
        end $$;`);

      expect(get(rows, "first")).toEqual(["ok"]);
      expect(get(rows, "second")).toEqual(["ok"]);
      expect(get(rows, "state")).toEqual(["1", "rate_limited"]);
    });

    it("should refuse a source or a kind that is not allowed", () => {
      const rows = run(`${SETUP}
        ${attempt("source", RECORD("radar", "timeout"))}
        ${attempt("kind", RECORD("provider", "boom"))}
        ${attempt("null", "perform public.record_flight_provider_error(null, null);")}`);

      expect(get(rows, "source")).toEqual(["22023"]);
      expect(get(rows, "kind")).toEqual(["22023"]);
      expect(get(rows, "null")).toEqual(["22023"]);
    });

    it("should change no flight: the data and the sync time stay (spec R12)", () => {
      const rows = run(`${SETUP}
        ${attempt("record", RECORD())}
        do $$ declare f record; n integer; begin
          select * into f from public.flights where id = '${FLIGHT}';
          select count(*) into n from public.flight_updates where flight_id = f.id;
          raise notice 'R|flight|%|%|%|%', f.status, f.terminal is null, f.last_synced_at = '2030-01-01 09:00:00+00', n;
        end $$;`);

      expect(get(rows, "record")).toEqual(["ok"]);
      expect(get(rows, "flight")).toEqual(["scheduled", "true", "true", "0"]);
    });
  });
});
