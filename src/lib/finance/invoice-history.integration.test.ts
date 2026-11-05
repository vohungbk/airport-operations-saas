import { describe, expect, it } from "vitest";

import { PARTNER, available, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F09-S10 (spec R9, R16): the history of the invoices and of their status changes, read with get_invoice_history(), is
 * kept with the actor and the time, is never deleted, and is given only within scope. A partner user is given only the
 * events that moved an invoice of its own partner to issued, paid or overdue, and only while the invoice is one of those
 * (the creation of a draft and the moves to void are internal). Everything runs in a transaction that is rolled back.
 * Needs an admin, an operations manager, a technician and a partner user for each of the two seed partners (present
 * after `npm run demo:reset`). Skipped when the local stack is not running, like the RLS suite.
 */
const OTHER_PARTNER = "b0000000-0000-0000-0000-000000000002";
const id = (n: number) => `d5600000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const [A, B, C, D] = [1, 2, 3, 4].map(id);

const USER_OF = (name: string, role: string, partner: string | null) => `
  select set_config('t.${name}', coalesce(
    (select id::text from public.users u where u.role = '${role}' and u.is_active
       ${partner ? `and u.partner_id = '${partner}'` : ""} order by u.email limit 1), ''), true);`;

const asKey = (key: string | null) =>
  `select set_config('request.jwt.claim.sub', ${key ? `current_setting('t.${key}')` : "''"}, true);`;

const invoice = (n: number, partner: string) => `
  insert into public.invoices (id, partner_id, invoice_number, issue_date, due_date, subtotal, vat, total, status)
  values ('${id(n)}', '${partner}', 'IH-${n}', '2026-01-01', '2026-01-31', 100, 5, 105, 'draft');`;

const move = (n: number, to: string) => `update public.invoices set status = '${to}' where id = '${id(n)}';`;

/** Reports `R|name|<events>|<events that are a draft or a void>` of the invoices of this test, read by `key`. */
const read = (name: string, key: string, args = "") => `
  ${asKey(key)}
  do $$ declare c integer; hidden integer; begin
    select count(*), count(*) filter (where h.to_status in ('draft', 'void'))
      into c, hidden
      from public.get_invoice_history(${args}) h
     where h.invoice_number like 'IH-%';
    raise notice 'R|${name}|%|%', c, hidden;
  end $$;`;

/** Runs any statement and reports `R|name|ok` or `R|name|<sqlstate>`. */
const attempt = (name: string, statement: string) => `
  do $$ begin
    ${statement}
    raise notice 'R|${name}|ok';
  exception when others then
    raise notice 'R|${name}|%', sqlstate;
  end $$;`;

const SETUP = `
  ${USER_OF("admin", "admin", null)}
  ${USER_OF("ops", "operations_manager", null)}
  ${USER_OF("owner", "partner_user", PARTNER)}
  ${USER_OF("other", "partner_user", OTHER_PARTNER)}
  ${USER_OF("tech", "technician", null)}
  select set_config('app.invoice_status_change', 'on', true);
  ${asKey("admin")}
  ${invoice(1, PARTNER)}
  ${move(1, "issued")}
  ${asKey(null)}
  ${move(1, "overdue")}
  ${asKey("admin")}
  ${move(1, "paid")}
  ${invoice(2, PARTNER)}
  ${move(2, "issued")}
  ${move(2, "void")}
  ${invoice(3, OTHER_PARTNER)}
  ${move(3, "issued")}
  ${invoice(4, PARTNER)}`;

describe.skipIf(!available)("invoice history (VI-F09-S10, spec R9, R16)", () => {
  const rows = available
    ? run(`
        ${SETUP}
        set local role authenticated;
        ${read("admin", "admin")}
        ${read("ops", "ops")}
        ${read("owner", "owner")}
        ${read("other", "other")}
        ${read("admin_a", "admin", `p_invoice_id => '${A}'`)}
        ${read("owner_a", "owner", `p_invoice_id => '${A}'`)}
        ${read("owner_b", "owner", `p_invoice_id => '${B}'`)}
        ${read("owner_c", "owner", `p_invoice_id => '${C}'`)}
        ${read("owner_d", "owner", `p_invoice_id => '${D}'`)}
        ${read("admin_year", "admin", `p_year => extract(year from now() at time zone 'Asia/Dubai')::integer`)}
        ${read("admin_old_year", "admin", "p_year => 1999")}
        ${asKey("admin")}
        do $$ begin
          raise notice 'R|actors|%|%|%|%',
            (select count(*) from public.get_invoice_history('${A}') h where h.actor_name is null),
            (select count(*) from public.get_invoice_history('${A}') h where h.actor_name is not null),
            (select count(h.changed_at) from public.get_invoice_history('${A}') h),
            (select h.reason from public.get_invoice_history('${A}') h where h.to_status = 'overdue');
        end $$;
        ${asKey("tech")}
        ${attempt("tech", `perform public.get_invoice_history();`)}
        ${asKey("admin")}
        ${attempt("delete_invoice", `delete from public.invoices where id = '${A}';`)}
        do $$ begin raise notice 'R|kept|%', (select count(*) from public.invoices where id = '${A}'); end $$;
        ${attempt("delete_history", `delete from public.finance_history where row_id = '${A}';`)}
        reset role;
        do $$ begin raise notice 'R|history_kept|%', (select count(*) from public.finance_history where row_id = '${A}'); end $$;
        set local role anon;
        ${attempt("anon", `perform public.get_invoice_history();`)}`)
    : [];

  const get = (name: string) => rows.find((r) => r[0] === name)?.slice(1);

  it("should give an admin and an operations manager every creation and status change, drafts and voids included (AC02)", () => {
    expect(get("admin")).toEqual(["10", "5"]);
    expect(get("ops")).toEqual(["10", "5"]);
  });

  it("should give a partner user only the moves of its own invoices to issued, overdue or paid (AC02)", () => {
    expect(get("owner")).toEqual(["3", "0"]);
    expect(get("owner_a")).toEqual(["3", "0"]);
  });

  it("should give a partner user nothing of an invoice that is void or still a draft", () => {
    expect(get("owner_b")).toEqual(["0", "0"]);
    expect(get("owner_d")).toEqual(["0", "0"]);
  });

  it("should give a partner user nothing of another partner's invoice, even when it asks for it by id (cross-tenant denial)", () => {
    expect(get("owner_c")).toEqual(["0", "0"]);
    expect(get("other")).toEqual(["1", "0"]);
  });

  it("should limit the events to one invoice and to one year", () => {
    expect(get("admin_a")).toEqual(["4", "1"]);
    expect(get("admin_year")).toEqual(["10", "5"]);
    expect(get("admin_old_year")).toEqual(["0", "0"]);
  });

  it("should keep each event with its time and its actor, and no actor for a change the database made (AC04)", () => {
    expect(get("actors")).toEqual(["1", "3", "4", "Invoice status moved from issued to overdue"]);
  });

  it("should refuse a technician and a signed-out client (42501)", () => {
    expect(get("tech")).toEqual(["42501"]);
    expect(get("anon")).toEqual(["42501"]);
  });

  it("should never delete an invoice or its history for an app role (AC04)", () => {
    expect(get("kept")).toEqual(["1"]);
    expect(get("delete_history")).toEqual(["42501"]);
    expect(get("history_kept")).toEqual(["4"]);
  });
});
