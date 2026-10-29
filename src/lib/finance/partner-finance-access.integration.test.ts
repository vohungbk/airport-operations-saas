import { describe, expect, it } from "vitest";

import { PARTNER, available, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F04-S14: a partner user reads only the settlements and the invoices of its own partner. This
 * reads both tables with the real RLS of each role, in a transaction that is rolled back: a partner
 * user of the owning partner sees them, a partner user of another partner sees nothing, and neither
 * does a technician. Needs a partner user for each of the two seed partners and a technician
 * (present after `npm run demo:reset`). Skipped when the local stack is not running.
 */
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";
const SETTLEMENT = "d8000000-0000-0000-0000-000000000001";
const INVOICE = "d8000000-0000-0000-0000-000000000002";

const USER_OF = (name: string, role: string, partner: string | null) => `
  select set_config('t.${name}', coalesce(
    (select id::text from public.users u where u.role = '${role}' and u.is_active
       ${partner ? `and u.partner_id = '${partner}'` : ""} order by u.email limit 1), ''), true);`;

const readAs = (name: string) => `
  select set_config('request.jwt.claim.sub', current_setting('t.${name}'), true);
  do $$ declare n_settlements integer; n_invoices integer; begin
    select count(*) into n_settlements from public.settlements where id = '${SETTLEMENT}';
    select count(*) into n_invoices from public.invoices where id = '${INVOICE}';
    raise notice 'R|${name}|%|%', n_settlements, n_invoices;
  end $$;`;

describe.skipIf(!available)("who can read the finance of a partner (VI-F04-S14)", () => {
  const rows = available
    ? run(`
        ${USER_OF("owner", "partner_user", PARTNER)}
        ${USER_OF("other", "partner_user", OTHER_PARTNER)}
        ${USER_OF("tech", "technician", null)}
        do $$ begin
          raise notice 'R|have|%|%|%', current_setting('t.owner') <> '', current_setting('t.other') <> '',
            current_setting('t.tech') <> '';
        end $$;
        insert into public.settlements (id, partner_id, period_start, period_end, gross_revenue, partner_share, final_amount, status)
        values ('${SETTLEMENT}', '${PARTNER}', date '2030-01-01', date '2030-01-31', 1000, 500, 500, 'approved');
        insert into public.invoices (id, partner_id, settlement_id, invoice_number, issue_date, due_date, subtotal, total, status)
        values ('${INVOICE}', '${PARTNER}', '${SETTLEMENT}', 'INV-TEST-0001', date '2030-01-31', date '2030-02-28', 500, 525, 'issued');
        set local role authenticated;
        ${readAs("owner")}
        ${readAs("other")}
        ${readAs("tech")}`)
    : [];

  const get = (name: string) => rows.find((r) => r[0] === name)?.slice(1);

  it("should have the users it needs: a partner user of each partner and a technician", () => {
    expect(get("have")).toEqual(["t", "t", "t"]);
  });

  it("should show a partner user the settlement and the invoice of its own partner", () => {
    expect(get("owner")).toEqual(["1", "1"]);
  });

  it("should show a partner user of another partner no settlement and no invoice (cross-tenant denial)", () => {
    expect(get("other")).toEqual(["0", "0"]);
  });

  it("should show a technician no settlement and no invoice", () => {
    expect(get("tech")).toEqual(["0", "0"]);
  });
});
