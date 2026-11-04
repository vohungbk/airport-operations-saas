import { describe, expect, it } from "vitest";

import { asUser, available, newPartner, partnerId, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F09-S09 (AC01, spec R12): an invoice that is issued and not paid becomes overdue once its due date has passed.
 * The function is for the system only. Every scenario runs in a transaction that is rolled back, with a fixed "today"
 * so the tests do not depend on the clock. Skipped when the local stack is not running, like the RLS suite.
 */
const invoiceId = (n: number) => `d5500000-0000-0000-0000-${String(n).padStart(12, "0")}`;

/** The day the function is run on in these tests; the invoices are due on the day before, on this day or after it. */
const TODAY = "2026-02-01";

/** An invoice with one line, made while it is a draft (its lines are locked after), then set to the status asked for (a draft can be set to any status; only a move between the other statuses is guarded). */
const invoiceOf = (n: number, due: string, status: string, partner = 1) => `
  insert into public.invoices (id, partner_id, invoice_number, issue_date, due_date, subtotal, vat, total, status)
  values ('${invoiceId(n)}', '${partnerId(partner)}', 'MO-${n}', '2026-01-01', '${due}', 100, 5, 105, 'draft');
  insert into public.invoice_lines (invoice_id, position, description, amount, counts_toward_subtotal)
  values ('${invoiceId(n)}', 1, 'Platform share', 100, true);
  ${status === "draft" ? "" : `update public.invoices set status = '${status}' where id = '${invoiceId(n)}';`}`;

/** Runs the function; reports `R|name|<count>|<eligible before>` so the count can be compared with the rows it should move. */
const mark = (name: string, today = TODAY) => `
  do $$ declare eligible integer; moved integer; begin
    select count(*) into eligible from public.invoices where status = 'issued' and due_date < '${today}';
    moved := public.mark_overdue_invoices('${today}');
    raise notice 'R|${name}|%|%', moved, eligible;
  end $$;`;

/** Reports `R|name|<status>|<number>|<total>` of the invoice. */
const state = (name: string, n: number) => `
  do $$ begin raise notice 'R|${name}|%|%|%', (select status from public.invoices where id = '${invoiceId(n)}'),
    (select invoice_number from public.invoices where id = '${invoiceId(n)}'),
    (select total from public.invoices where id = '${invoiceId(n)}'); end $$;`;

/** Reports `R|name|<rows>|<changed_by or null>|<reason>` of the history rows that moved the invoice to overdue. */
const history = (name: string, n: number) => `
  do $$ declare h record; c integer; begin
    select count(*) into c from public.finance_history
     where table_name = 'invoices' and row_id = '${invoiceId(n)}' and new_values->>'status' = 'overdue';
    select * into h from public.finance_history
     where table_name = 'invoices' and row_id = '${invoiceId(n)}' and new_values->>'status' = 'overdue' limit 1;
    raise notice 'R|${name}|%|%|%', c, coalesce(h.changed_by::text, 'null'), coalesce(h.reason, 'none');
  end $$;`;

/** Runs the function as a signed-in role; reports `R|name|ok` or `R|name|<sqlstate>`. */
const callAs = (name: string, role: string) => `
  set local role ${role};
  do $$ begin
    perform public.mark_overdue_invoices('${TODAY}');
    raise notice 'R|${name}|ok';
  exception when others then
    raise notice 'R|${name}|%', sqlstate;
  end $$;
  reset role;`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("marking overdue invoices (VI-F09-S09, spec R12)", () => {
  it("should mark an issued invoice as overdue when its due date has passed (AC01)", () => {
    const rows = run(`
      ${newPartner(1)}
      ${invoiceOf(1, "2026-01-31", "issued")}
      ${mark("m")}
      ${state("s", 1)}`);

    const [moved, eligible] = get(rows, "m");
    expect(moved).toBe(eligible);
    expect(Number(moved)).toBeGreaterThanOrEqual(1);
    expect(get(rows, "s")).toEqual(["overdue", "MO-1", "105.00"]);
  });

  it("should keep the change in finance history with no actor and the reason", () => {
    const rows = run(`
      ${newPartner(1)}
      ${invoiceOf(1, "2026-01-31", "issued")}
      ${mark("m")}
      ${history("h", 1)}`);

    expect(get(rows, "h")).toEqual(["1", "null", "Invoice passed its due date"]);
  });

  it("should keep an invoice issued when its due date is today", () => {
    const rows = run(`
      ${newPartner(1)}
      ${invoiceOf(1, TODAY, "issued")}
      ${invoiceOf(2, "2026-02-02", "issued")}
      ${mark("m")}
      ${state("today", 1)}
      ${state("later", 2)}`);

    expect(get(rows, "today")[0]).toBe("issued");
    expect(get(rows, "later")[0]).toBe("issued");
  });

  it("should not touch invoices that are paid, void, draft or already overdue", () => {
    const rows = run(`
      ${newPartner(1)}
      ${invoiceOf(1, "2026-01-31", "paid")}
      ${invoiceOf(2, "2026-01-31", "void")}
      ${invoiceOf(3, "2026-01-31", "draft")}
      ${invoiceOf(4, "2026-01-31", "overdue")}
      ${mark("m")}
      ${state("paid", 1)}
      ${state("void", 2)}
      ${state("draft", 3)}
      ${state("overdue", 4)}
      ${history("h", 4)}`);

    expect(get(rows, "paid")[0]).toBe("paid");
    expect(get(rows, "void")[0]).toBe("void");
    expect(get(rows, "draft")[0]).toBe("draft");
    expect(get(rows, "overdue")[0]).toBe("overdue");
    // The one history row is the one of the update that made it overdue; the run did not write it again.
    expect(get(rows, "h")[0]).toBe("1");
  });

  it("should move nothing on a second run", () => {
    const rows = run(`
      ${newPartner(1)}
      ${invoiceOf(1, "2026-01-31", "issued")}
      ${mark("first")}
      ${mark("second")}`);

    expect(get(rows, "second")).toEqual(["0", "0"]);
  });

  it("should mark the overdue invoices of every partner in one run", () => {
    const rows = run(`
      ${newPartner(1)}
      ${newPartner(2)}
      ${invoiceOf(1, "2026-01-31", "issued", 1)}
      ${invoiceOf(2, "2026-01-15", "issued", 2)}
      ${mark("m")}
      ${state("a", 1)}
      ${state("b", 2)}`);

    expect(get(rows, "a")[0]).toBe("overdue");
    expect(get(rows, "b")[0]).toBe("overdue");
  });

  it.each([
    ["anon", null],
    ["authenticated", "admin"],
  ])("should refuse the %s role, even for an admin who signs in", (role, user) => {
    const rows = run(`
      ${newPartner(1)}
      ${invoiceOf(1, "2026-01-31", "issued")}
      ${asUser(user)}
      ${callAs("c", role)}
      ${state("s", 1)}`);

    expect(get(rows, "c")).toEqual(["42501"]);
    expect(get(rows, "s")[0]).toBe("issued");
  });
});
