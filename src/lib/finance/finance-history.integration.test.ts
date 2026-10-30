import { describe, expect, it } from "vitest";

import {
  PARTNER,
  USER,
  adjustmentSetup as setup,
  asUser,
  available,
  completeBooking,
  newBooking,
  partnerId,
  run,
} from "@/lib/finance/finance-test-support";

/**
 * VI-F04-S16 (spec R16): every change of a financial value is kept with who made it, when and why,
 * and the history is never deleted. This runs the real functions and triggers of the local database,
 * each scenario in a transaction that is rolled back. The partner of a scenario has launch terms
 * (target 1000, launch share 50, standard share 30) and one rental of six days at 75 in January 2026.
 * Needs an admin, an operations manager, a technician and a partner user for each of the two seed
 * partners (present after `npm run demo:reset`). Skipped when the local stack is not running, like
 * the RLS suite.
 */
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";
const JANUARY = "2026-01-01";

const rental = (n: number, partner: number) => `
  ${newBooking(n, partner, "2026-01-07 10:00:00+00", "75", "2026-01-01 10:00:00+00")}
  ${completeBooking(n)}`;

const settlementOf = (partner: number) =>
  `(select id from public.settlements where partner_id = '${partnerId(partner)}' and period_start = date '${JANUARY}')`;

const generate = (partner: number) => `select public.generate_monthly_settlement('${partnerId(partner)}', date '${JANUARY}');`;

const move = (partner: number, to: string) => `select public.move_settlement_status(${settlementOf(partner)}, '${to}');`;

/** Reports `R|name|table|action|by the admin|reason|old status|new status`, one line per kept change. */
const history = (name: string, partner: number) => `
  do $$ declare h record; begin
    for h in select * from public.finance_history where partner_id = '${partnerId(partner)}' order by table_name, reason loop
      raise notice 'R|${name}|%|%|%|%|%|%', h.table_name, h.action, (h.changed_by is not distinct from ${USER("admin")}::uuid),
        h.reason, coalesce(h.old_values ->> 'status', '-'), coalesce(h.new_values ->> 'status', '-');
    end loop;
  end $$;`;

const count = (name: string, partner: number) => `
  do $$ declare c integer; begin
    select count(*) into c from public.finance_history where partner_id = '${partnerId(partner)}';
    raise notice 'R|${name}|%', c;
  end $$;`;

/** Runs a statement and reports `R|name|ok` or `R|name|<sqlstate>`. */
const attempt = (name: string, statement: string) => `
  do $$ begin
    ${statement}
    raise notice 'R|${name}|ok';
  exception when others then
    raise notice 'R|${name}|%', sqlstate;
  end $$;`;

const get = (rows: string[][], name: string) => rows.filter((r) => r[0] === name).map((r) => r.slice(1));

describe.skipIf(!available)("the financial history (VI-F04-S16, spec R16)", () => {
  const kept = available
    ? run(`
        ${setup(20, { target: "1000", launch: 50 })}
        ${rental(20, 20)}
        ${asUser("admin")}
        ${generate(20)}
        ${move(20, "pending_approval")}
        ${move(20, "approved")}
        ${history("h", 20)}`)
    : [];

  it("should keep the terms saved and the launch credit a rental added, with no actor when the database made the change (AC01)", () => {
    expect(get(kept, "h").slice(0, 2)).toEqual([
      ["partner_commercial_terms", "insert", "f", "Commercial terms version saved", "-", "-"],
      ["partner_commercial_terms", "update", "f", "Launch credit updated by a completed rental", "-", "-"],
    ]);
  });

  it("should keep the settlement generated and every move of its status, each by the admin who made it (AC01)", () => {
    expect(get(kept, "h").slice(2)).toEqual([
      ["settlements", "insert", "t", "Settlement generated for 2026-01", "-", "draft"],
      ["settlements", "update", "t", "Status moved from draft to pending_approval", "draft", "pending_approval"],
      ["settlements", "update", "t", "Status moved from pending_approval to approved", "pending_approval", "approved"],
    ]);
  });

  describe("what is and is not a change", () => {
    const rows = available
      ? run(`
          ${setup(21)}
          ${rental(21, 21)}
          ${asUser("admin")}
          ${generate(21)}
          ${count("before", 21)}
          update public.settlements set updated_at = now() + interval '1 day' where id = ${settlementOf(21)};
          ${count("same", 21)}
          update public.settlements set gross_revenue = gross_revenue + 1 where id = ${settlementOf(21)};
          select set_config('app.finance_reason', 'Corrected after the audit', true);
          update public.settlements set partner_share = partner_share + 1 where id = ${settlementOf(21)};
          do $$ declare h record; begin
            for h in select reason, old_values, new_values from public.finance_history
                      where partner_id = '${partnerId(21)}' and table_name = 'settlements' and action = 'update' order by reason loop
              raise notice 'R|u|%|%|%', h.reason, (select string_agg(k, ',' order by k) from jsonb_object_keys(h.new_values) k),
                h.old_values ->> 'gross_revenue';
            end loop;
          end $$;`)
      : [];

    it("should not keep an update that only touches updated_at", () => {
      expect(get(rows, "same")).toEqual(get(rows, "before"));
    });

    it("should keep only the columns that changed, with their old values, and a reason worked out from them", () => {
      expect(get(rows, "u")).toContainEqual(["Settlement figures changed", "gross_revenue", "450.00"]);
    });

    it("should use the reason a writer sets for the transaction instead of the one worked out", () => {
      expect(get(rows, "u").map((r) => r[0])).toContain("Corrected after the audit");
    });
  });

  describe("never deleted", () => {
    const rows = available
      ? run(`
          ${setup(22)}
          ${rental(22, 22)}
          ${asUser("admin")}
          ${generate(22)}
          ${count("before", 22)}
          ${attempt("update", `update public.finance_history set reason = 'Rewritten' where partner_id = '${partnerId(22)}';`)}
          ${attempt("delete", `delete from public.finance_history where partner_id = '${partnerId(22)}';`)}
          ${attempt("truncate", "truncate public.finance_history;")}
          ${count("after", 22)}
          create policy tmp_delete on public.settlements for delete to authenticated using (true);
          grant delete on public.settlements to authenticated;
          ${attempt("app-delete", `set local role authenticated; delete from public.settlements where partner_id = '${partnerId(22)}';`)}
          reset role;
          do $$ declare c integer; begin
            select count(*) into c from public.settlements where partner_id = '${partnerId(22)}';
            raise notice 'R|settlement|%', c;
          end $$;
          delete from public.settlements where partner_id = '${partnerId(22)}';
          ${count("gone", 22)}`)
      : [];

    it.each(["update", "delete", "truncate"])("should refuse to %s the history, even as the database owner (55000)", (action) => {
      expect(get(rows, action)).toEqual([["55000"]]);
      expect(get(rows, "after")).toEqual(get(rows, "before"));
    });

    it("should refuse an app role the delete of a finance row even if a policy allowed it, and keep the row (55000)", () => {
      expect(get(rows, "app-delete")).toEqual([["55000"]]);
      expect(get(rows, "settlement")).toEqual([["1"]]);
    });

    it("should keep the history of a settlement that the database owner removes", () => {
      expect(Number(get(rows, "gone")[0][0])).toBeGreaterThanOrEqual(Number(get(rows, "before")[0][0]));
    });
  });

  describe("who may read it", () => {
    const USER_OF = (key: string, role: string, partner: string | null) => `
      select set_config('t.${key}', coalesce(
        (select id::text from public.users u where u.role = '${role}' and u.is_active
           ${partner ? `and u.partner_id = '${partner}'` : ""} order by u.email limit 1), ''), true);`;

    const readAs = (name: string, key: string) => `
      select set_config('request.jwt.claim.sub', current_setting('t.${key}'), true);
      do $$ declare c integer; begin
        select count(*) into c from public.finance_history where row_id = 'd8400000-0000-0000-0000-000000000001';
        raise notice 'R|${name}|%', c;
      end $$;`;

    const rows = available
      ? run(`
          ${USER_OF("admin", "admin", null)}
          ${USER_OF("ops", "operations_manager", null)}
          ${USER_OF("owner", "partner_user", PARTNER)}
          ${USER_OF("other", "partner_user", OTHER_PARTNER)}
          ${USER_OF("tech", "technician", null)}
          insert into public.settlements (id, partner_id, period_start, period_end)
          values ('d8400000-0000-0000-0000-000000000001', '${PARTNER}', date '2033-01-01', date '2033-01-31');
          set local role authenticated;
          ${readAs("admin", "admin")}
          ${readAs("ops", "ops")}
          ${readAs("owner", "owner")}
          ${readAs("other", "other")}
          ${readAs("tech", "tech")}
          ${attempt("write", `insert into public.finance_history (table_name, row_id, action, reason, new_values) values ('invoices', gen_random_uuid(), 'insert', 'Forged', '{}'::jsonb);`)}`)
      : [];

    it("should show an admin and an operations manager the history of any partner", () => {
      expect(get(rows, "admin")).toEqual([["1"]]);
      expect(get(rows, "ops")).toEqual([["1"]]);
    });

    it("should show a partner user of its own partner, a partner user of another partner and a technician nothing (cross-tenant denial)", () => {
      for (const who of ["owner", "other", "tech"]) {
        expect(get(rows, who), who).toEqual([["0"]]);
      }
    });

    it("should refuse an app role who writes the history directly (42501)", () => {
      expect(get(rows, "write")).toEqual([["42501"]]);
    });
  });
});
