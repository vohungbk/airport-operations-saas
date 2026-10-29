import { describe, expect, it } from "vitest";

import { AIRPORT, CATEGORY, PARTNER, available, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F04-S15 (spec R18, E9): who may read and write the finance data, proved with the real RLS of each
 * role, in a transaction that is rolled back. AC01: an admin and an operations manager see every
 * partner, a partner user only its own, a technician nothing, and nobody but the admin writes. AC02: a
 * partner who asks for another partner's finance gets the same refusal as for an id that does not
 * exist, so nothing tells whether the other partner's row is there. Needs an admin, an operations
 * manager, a technician and a partner user for each of the two seed partners (present after
 * `npm run demo:reset`). Skipped when the local stack is not running.
 */
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";
const SETTLEMENT_A = "d8100000-0000-0000-0000-000000000001";
const SETTLEMENT_B = "d8100000-0000-0000-0000-000000000002";
const INVOICE_A = "d8200000-0000-0000-0000-000000000001";
const INVOICE_B = "d8200000-0000-0000-0000-000000000002";
const BOOKING_A = "d8300000-0000-0000-0000-000000000001";
const UNKNOWN = "d8ffffff-0000-0000-0000-000000000000";

const USER_OF = (key: string, role: string, partner: string | null) => `
  select set_config('t.${key}', coalesce(
    (select id::text from public.users u where u.role = '${role}' and u.is_active
       ${partner ? `and u.partner_id = '${partner}'` : ""} order by u.email limit 1), ''), true);`;

/** Both partners have a settlement, an invoice and terms; the rows are made as the database owner. */
const FIXTURE = `
  insert into public.partner_commercial_terms (partner_id, effective_from)
  select '${OTHER_PARTNER}', date '2000-01-01'
   where not exists (select 1 from public.partner_commercial_terms t where t.partner_id = '${OTHER_PARTNER}');
  insert into public.settlements (id, partner_id, period_start, period_end, status) values
    ('${SETTLEMENT_A}', '${PARTNER}', date '2031-01-01', date '2031-01-31', 'approved'),
    ('${SETTLEMENT_B}', '${OTHER_PARTNER}', date '2031-01-01', date '2031-01-31', 'approved');
  insert into public.invoices (id, partner_id, settlement_id, invoice_number, issue_date, due_date, subtotal, total, status) values
    ('${INVOICE_A}', '${PARTNER}', '${SETTLEMENT_A}', 'INV-S15-A', date '2031-01-31', date '2031-02-28', 100, 105, 'issued'),
    ('${INVOICE_B}', '${OTHER_PARTNER}', '${SETTLEMENT_B}', 'INV-S15-B', date '2031-01-31', date '2031-02-28', 100, 105, 'issued');
  insert into public.bookings (id, booking_number, partner_id, airport_id, pickup_at, return_at, seat_category_id, daily_rate)
  values ('${BOOKING_A}', 'S15-0001', '${PARTNER}', '${AIRPORT}', '2031-01-01 10:00:00+00', '2031-01-04 10:00:00+00', '${CATEGORY}', 90);`;

/** `R|name|<settlements of A>|<of B>|<invoices of A>|<of B>|<terms of A>|<of B>` as the given user. */
const readAs = (name: string, key: string) => `
  select set_config('request.jwt.claim.sub', current_setting('t.${key}'), true);
  do $$ declare c integer[] := array[]::integer[]; p uuid; begin
    foreach p in array array['${PARTNER}', '${OTHER_PARTNER}']::uuid[] loop
      c := c || (select count(*)::integer from public.settlements where partner_id = p and id in ('${SETTLEMENT_A}', '${SETTLEMENT_B}'));
    end loop;
    foreach p in array array['${PARTNER}', '${OTHER_PARTNER}']::uuid[] loop
      c := c || (select count(*)::integer from public.invoices where partner_id = p and id in ('${INVOICE_A}', '${INVOICE_B}'));
    end loop;
    foreach p in array array['${PARTNER}', '${OTHER_PARTNER}']::uuid[] loop
      c := c || (select count(*)::integer from public.partner_commercial_terms where partner_id = p);
    end loop;
    raise notice 'R|${name}|%|%|%|%|%|%', c[1], c[2], c[3], c[4], c[5] > 0, c[6] > 0;
  end $$;`;

/** A write as the given user: an insert reports its sqlstate, an update reports how many rows it changed. */
const writeAs = (name: string, key: string) => `
  select set_config('request.jwt.claim.sub', current_setting('t.${key}'), true);
  do $$ declare n integer; begin
    begin
      insert into public.settlements (partner_id, period_start, period_end) values ('${PARTNER}', date '2032-01-01', date '2032-01-31');
      raise notice 'R|${name}|insert|ok';
    exception when others then
      raise notice 'R|${name}|insert|%', sqlstate;
    end;
    begin
      update public.settlements set final_amount = 1 where id = '${SETTLEMENT_A}';
      get diagnostics n = row_count;
      raise notice 'R|${name}|update|%', n;
    exception when others then
      raise notice 'R|${name}|update|%', sqlstate;
    end;
  end $$;`;

/** A function call as the given user: reports `R|name|<sqlstate>|<message>`, or `ok`. */
const callAs = (name: string, key: string, call: string) => `
  select set_config('request.jwt.claim.sub', current_setting('t.${key}'), true);
  do $$ begin
    perform ${call};
    raise notice 'R|${name}|ok|';
  exception when others then
    raise notice 'R|${name}|%|%', sqlstate, sqlerrm;
  end $$;`;

describe.skipIf(!available)("who can read and write the finance data (VI-F04-S15, spec R18, E9)", () => {
  const rows = available
    ? run(`
        ${USER_OF("admin", "admin", null)}
        ${USER_OF("ops", "operations_manager", null)}
        ${USER_OF("owner", "partner_user", PARTNER)}
        ${USER_OF("other", "partner_user", OTHER_PARTNER)}
        ${USER_OF("tech", "technician", null)}
        do $$ begin
          raise notice 'R|have|%|%|%|%|%', current_setting('t.admin') <> '', current_setting('t.ops') <> '',
            current_setting('t.owner') <> '', current_setting('t.other') <> '', current_setting('t.tech') <> '';
        end $$;
        ${FIXTURE}
        set local role authenticated;
        ${readAs("admin", "admin")}
        ${readAs("ops", "ops")}
        ${readAs("owner", "owner")}
        ${readAs("other", "other")}
        ${readAs("tech", "tech")}
        ${writeAs("write-ops", "ops")}
        ${writeAs("write-owner", "owner")}
        ${writeAs("write-tech", "tech")}
        ${callAs("move-other", "owner", `public.move_settlement_status('${SETTLEMENT_B}', 'pending_approval')`)}
        ${callAs("move-unknown", "owner", `public.move_settlement_status('${UNKNOWN}', 'pending_approval')`)}
        ${callAs("generate-other", "owner", `public.generate_monthly_settlement('${OTHER_PARTNER}', date '2031-01-01')`)}
        ${callAs("generate-unknown", "owner", `public.generate_monthly_settlement('${UNKNOWN}', date '2031-01-01')`)}
        ${callAs("adjust-other", "other", `public.add_booking_adjustment('${BOOKING_A}', 'partial_refund', 10, 'A reason')`)}
        ${callAs("adjust-unknown", "other", `public.add_booking_adjustment('${UNKNOWN}', 'partial_refund', 10, 'A reason')`)}
        ${callAs("generate-ops", "ops", `public.generate_monthly_settlement('${OTHER_PARTNER}', date '2031-01-01')`)}`)
    : [];

  const get = (name: string) => rows.filter((r) => r[0] === name).map((r) => r.slice(1));
  const one = (name: string) => get(name)[0];

  it("should have the users it needs: an admin, an operations manager, a partner user of each partner and a technician", () => {
    expect(one("have")).toEqual(["t", "t", "t", "t", "t"]);
  });

  it.each(["admin", "ops"])("should show %s the settlements, invoices and terms of every partner (AC01)", (role) => {
    expect(one(role)).toEqual(["1", "1", "1", "1", "t", "t"]);
  });

  it("should show a partner user only the settlement, invoice and terms of its own partner (AC01)", () => {
    expect(one("owner")).toEqual(["1", "0", "1", "0", "t", "f"]);
    expect(one("other")).toEqual(["0", "1", "0", "1", "f", "t"]);
  });

  it("should show a technician no settlement, invoice or terms of any partner (AC01)", () => {
    expect(one("tech")).toEqual(["0", "0", "0", "0", "f", "f"]);
  });

  it.each(["ops", "owner", "tech"])("should let %s neither create nor change a settlement, their own partner's included", (role) => {
    expect(get(`write-${role}`)).toEqual([["insert", "42501"], ["update", "0"]]);
  });

  it("should refuse a partner user who asks to move or generate another partner's settlement with the same answer as for an id that does not exist (AC02)", () => {
    expect(one("move-other")).toEqual(one("move-unknown"));
    expect(one("move-other")[0]).toBe("42501");
    expect(one("generate-other")).toEqual(one("generate-unknown"));
    expect(one("generate-other")[0]).toBe("42501");
  });

  it("should refuse a partner user who asks to adjust another partner's booking with the same answer as for an unknown booking (AC02)", () => {
    expect(one("adjust-other")).toEqual(one("adjust-unknown"));
    expect(one("adjust-other")[0]).toBe("42501");
  });

  it("should refuse an operations manager who asks to generate a settlement: only the admin may (AC01)", () => {
    expect(one("generate-ops")[0]).toBe("42501");
  });
});
