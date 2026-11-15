import { describe, expect, it } from "vitest";

import { AIRPORT, CATEGORY, USER, available, newPartner, partnerId, run } from "@/lib/finance/finance-test-support";

/**
 * CO-F07-S08, S09, S10: receive_webhook_booking() creates a pending booking for the partner of the webhook
 * configuration and records the source "webhook" (R11, R14), answers the first booking for a repeated external
 * booking number (R13), limits the calls (E6) and logs each one. The secret and the functions are closed to a
 * signed-in user (R12, R15), and the log can neither be changed nor deleted. Every scenario runs in a transaction
 * that is rolled back and makes its own partner. Skipped when the local stack is not running.
 */
const configId = (n: number) => `d5300000-0000-0000-0000-${String(n).padStart(12, "0")}`;

const newConfig = (n: number) => `
  ${newPartner(n)}
  insert into public.booking_webhook_config (id, partner_id, airport_id, secret)
  values ('${configId(n)}', '${partnerId(n)}', '${AIRPORT}', 'a-secret-of-at-least-32-characters-long');`;

const body = (external: string) =>
  JSON.stringify({
    external_booking_number: external,
    seat_category_id: CATEGORY,
    pickup_at: "2030-01-01T10:00:00Z",
    return_at: "2030-01-04T10:00:00Z",
    daily_rate: 90,
  });

/** Calls the function and reports `R|name|<status>|<has booking>`. */
const receive = (name: string, n: number, json: string) => `
  do $$ declare r jsonb; begin
    r := public.receive_webhook_booking('${configId(n)}', '${json}'::jsonb);
    raise notice 'R|${name}|%|%', r->>'status', (r->>'booking_id') is not null;
  end $$;`;

const get = (rows: string[][], name: string) => {
  const found = rows.find((r) => r[0] === name);
  expect(found, name).toBeDefined();
  return found!.slice(1);
};

describe.skipIf(!available)("booking webhook (CO-F07-S08, S09, S10)", () => {
  it("should create a pending booking for the partner of the configuration and record the source webhook (R11, R14, R15)", () => {
    const rows = run(`
      ${newConfig(51)}
      ${receive("call", 51, body("EXT-1"))}
      do $$ declare s text; e text; begin
        select b.status into s from public.bookings b where b.partner_id = '${partnerId(51)}';
        select ev.metadata->>'source' into e from public.booking_events ev join public.bookings b on b.id = ev.booking_id
         where b.partner_id = '${partnerId(51)}' and ev.metadata->>'event_type' = 'created';
        raise notice 'R|state|%|%', s, e;
      end $$;`);

    expect(get(rows, "call")).toEqual(["created", "true"]);
    expect(get(rows, "state")).toEqual(["pending", "webhook"]);
  });

  it("should return the first booking and create no second one for a repeated external booking number (R13)", () => {
    const rows = run(`
      ${newConfig(52)}
      ${receive("first", 52, body("EXT-1"))}
      ${receive("again", 52, body("EXT-1"))}
      do $$ declare c integer; l integer; begin
        select count(*) into c from public.bookings where partner_id = '${partnerId(52)}';
        select count(*) into l from public.booking_webhook_calls where partner_id = '${partnerId(52)}' and result = 'duplicate';
        raise notice 'R|count|%|%', c, l;
      end $$;`);

    expect(get(rows, "again")).toEqual(["duplicate", "true"]);
    expect(get(rows, "count")).toEqual(["1", "1"]);
  });

  it("should limit the calls and create nothing for the extra call (E6)", () => {
    const rows = run(`
      ${newConfig(53)}
      insert into public.booking_webhook_calls (config_id, partner_id, result)
      select '${configId(53)}', '${partnerId(53)}', 'created' from generate_series(1, 60);
      ${receive("limited", 53, body("EXT-1"))}
      do $$ declare c integer; begin
        select count(*) into c from public.bookings where partner_id = '${partnerId(53)}';
        raise notice 'R|count|%', c;
      end $$;`);

    expect(get(rows, "limited")).toEqual(["rate_limited", "false"]);
    expect(get(rows, "count")).toEqual(["0"]);
  });

  it("should reject a call with an inactive seat category, log it and create nothing (E7)", () => {
    const rows = run(`
      ${newConfig(54)}
      ${receive("call", 54, body("EXT-1").replace(CATEGORY, "c0000000-0000-0000-0000-0000000000ff"))}
      do $$ declare c integer; l text; begin
        select count(*) into c from public.bookings where partner_id = '${partnerId(54)}';
        select result into l from public.booking_webhook_calls where partner_id = '${partnerId(54)}';
        raise notice 'R|state|%|%', c, l;
      end $$;`);

    expect(get(rows, "call")).toEqual(["rejected", "false"]);
    expect(get(rows, "state")).toEqual(["0", "rejected"]);
  });

  it.each(["admin", "operations_manager", "partner_user"])(
    "should refuse the webhook functions and the secret to a signed-in %s (R12)",
    (role) => {
      const rows = run(`
        ${newConfig(55)}
        do $$ begin
          perform set_config('request.jwt.claim.sub', coalesce(${USER(role)}, ''), true);
          set local role authenticated;
          perform public.receive_webhook_booking('${configId(55)}', '${body("EXT-1")}'::jsonb);
          reset role;
          raise notice 'R|call|ok';
        exception when others then
          raise notice 'R|call|%', sqlstate;
        end $$;
        do $$ begin
          perform set_config('request.jwt.claim.sub', coalesce(${USER(role)}, ''), true);
          set local role authenticated;
          perform secret from public.booking_webhook_config;
          reset role;
          raise notice 'R|secret|ok';
        exception when others then
          raise notice 'R|secret|%', sqlstate;
        end $$;`);

      expect(get(rows, "call")).toEqual(["42501"]);
      expect(get(rows, "secret")).toEqual(["42501"]);
    },
  );

  it("should show the call log to an operations manager and none to a partner user (RLS)", () => {
    const rows = run(`
      ${newConfig(56)}
      ${receive("call", 56, body("EXT-1"))}
      do $$ declare ops integer; partner integer; begin
        perform set_config('request.jwt.claim.sub', coalesce(${USER("operations_manager")}, ''), true);
        set local role authenticated;
        select count(*) into ops from public.booking_webhook_calls where partner_id = '${partnerId(56)}';
        reset role;
        perform set_config('request.jwt.claim.sub', coalesce(${USER("partner_user")}, ''), true);
        set local role authenticated;
        select count(*) into partner from public.booking_webhook_calls where partner_id = '${partnerId(56)}';
        reset role;
        raise notice 'R|read|%|%', ops, partner;
      end $$;`);

    expect(get(rows, "read")).toEqual(["1", "0"]);
  });

  it.each(["update public.booking_webhook_calls set result = 'created'", "delete from public.booking_webhook_calls", "truncate public.booking_webhook_calls"])(
    "should refuse to change the call log: %s (history is never deleted)",
    (statement) => {
      const rows = run(`
        ${newConfig(57)}
        ${receive("call", 57, body("EXT-1"))}
        do $$ begin
          ${statement};
          raise notice 'R|change|ok';
        exception when others then
          raise notice 'R|change|%', sqlstate;
        end $$;`);

      expect(get(rows, "change")).toEqual(["55000"]);
    },
  );
});
