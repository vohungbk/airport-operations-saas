import { describe, expect, it } from "vitest";

import { asUser, available, newPartner, newTerms, partnerId, run } from "@/lib/finance/finance-test-support";

/**
 * VI-F09-S07 (spec R8, R11, R13): the admin issues a draft invoice: the status becomes issued, the issue date is today
 * and the due date is that day plus the payment terms of the partner (14 days by default). An invoice that is not a
 * draft keeps its amounts and its lines. Every scenario runs in a transaction that is rolled back. Skipped when the
 * local stack is not running, like the RLS suite.
 */
const invoiceId = (n: number) => `d5300000-0000-0000-0000-${String(n).padStart(12, "0")}`;

/**
 * An invoice of a partner with one line, made directly. It is a draft while its line is written (the guard refuses a
 * line on an invoice that is not a draft), then moved to the status asked for.
 */
const invoiceOf = (n: number, partner: number, status = "draft") => `
  insert into public.invoices (id, partner_id, invoice_number, issue_date, due_date, subtotal, vat, total, status)
  values ('${invoiceId(n)}', '${partnerId(partner)}', 'IS-${n}', '2026-01-01', '2026-01-31', 100, 5, 105, 'draft');
  insert into public.invoice_lines (invoice_id, position, description, amount, counts_toward_subtotal)
  values ('${invoiceId(n)}', 1, 'Platform share', 100, true);
  update public.invoices set status = '${status}' where id = '${invoiceId(n)}';`;

/** A version of the terms of a partner with the payment terms asked for (a version cannot be changed once saved). */
const termsWithDays = (n: number, partner: number, days: number, from: string, to = "null") => `
  insert into public.partner_commercial_terms
    (id, partner_id, partner_share_percent, platform_share_percent, launch_partner_share_percent, effective_from, effective_to, payment_terms_days)
  values ('d5200000-0000-0000-0000-${String(n).padStart(12, "0")}', '${partnerId(partner)}', 30, 70, 100, ${from}, ${to}, ${days});`;

/** Issues an invoice and reports `R|name|ok|status|issue date|days to pay|today` or `R|name|<sqlstate>`. */
const issue = (name: string, n: number) => `
  do $$ declare i public.invoices; begin
    i := public.issue_invoice('${invoiceId(n)}');
    raise notice 'R|${name}|ok|%|%|%|%', i.status, i.issue_date, i.due_date - i.issue_date, (now() at time zone 'UTC')::date;
  exception when others then
    raise notice 'R|${name}|%', sqlstate;
  end $$;`;

/** Runs any statement and reports `R|name|ok` or `R|name|<sqlstate>`. */
const attempt = (name: string, statement: string) => `
  do $$ begin
    ${statement}
    raise notice 'R|${name}|ok';
  exception when others then
    raise notice 'R|${name}|%', sqlstate;
  end $$;`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("issuing an invoice (VI-F09-S07, spec R8, R11, R13)", () => {
  it("should issue a draft today, due 14 days later by default (AC01, AC02)", () => {
    const rows = run(`
      ${newPartner(1)} ${newTerms(1, 1, 30, "date '2000-01-01'")}
      ${invoiceOf(1, 1)}
      ${asUser("admin")}
      ${issue("i", 1)}`);

    const [ok, status, issued, days, today] = get(rows, "i");

    expect([ok, status, days]).toEqual(["ok", "issued", "14"]);
    expect(issued).toBe(today);
  });

  it("should add the payment terms of the partner to the issue date (AC01, AC02)", () => {
    const rows = run(`
      ${newPartner(2)} ${termsWithDays(1, 2, 30, "date '2000-01-01'")}
      ${invoiceOf(1, 2)}
      ${asUser("admin")}
      ${issue("i", 1)}`);

    expect(get(rows, "i")[3]).toBe("30");
  });

  it("should use 14 days for a partner that has no terms (AC02)", () => {
    const rows = run(`
      ${newPartner(3)}
      ${invoiceOf(1, 3)}
      ${asUser("admin")}
      ${issue("i", 1)}`);

    expect(get(rows, "i")[3]).toBe("14");
  });

  it("should take the terms in force today, not an earlier or a later version (AC02)", () => {
    const rows = run(`
      ${newPartner(4)}
      ${termsWithDays(1, 4, 30, "date '1990-01-01'", "date '1999-12-31'")}
      ${termsWithDays(2, 4, 7, "date '2000-01-01'", "date '2999-12-31'")}
      ${termsWithDays(3, 4, 90, "date '3000-01-01'")}
      ${invoiceOf(1, 4)}
      ${asUser("admin")}
      ${issue("i", 1)}`);

    expect(get(rows, "i")[3]).toBe("7");
  });

  it.each([["issued"], ["paid"], ["overdue"], ["void"]])(
    "should refuse to issue an invoice that is %s with IV002, and not move its dates (AC01)",
    (status) => {
      const rows = run(`
        ${newPartner(5)}
        ${invoiceOf(1, 5, status)}
        ${asUser("admin")}
        ${issue("i", 1)}
        do $$ begin raise notice 'R|d|%|%', (select issue_date from public.invoices where id = '${invoiceId(1)}'), (select status from public.invoices where id = '${invoiceId(1)}'); end $$;`);

      expect(get(rows, "i")).toEqual(["IV002"]);
      expect(get(rows, "d")).toEqual(["2026-01-01", status]);
    },
  );

  it("should refuse a second issue of the same invoice with IV002 (AC01)", () => {
    const rows = run(`
      ${newPartner(6)}
      ${invoiceOf(1, 6)}
      ${asUser("admin")}
      ${issue("first", 1)}
      ${issue("again", 1)}`);

    expect([get(rows, "first")[0], get(rows, "again")[0]]).toEqual(["ok", "IV002"]);
  });

  it("should not let the amounts, the number, the dates or the partner of an issued invoice change (AC03)", () => {
    const rows = run(`
      ${newPartner(7)} ${newPartner(8)}
      ${invoiceOf(1, 7)}
      ${asUser("admin")}
      ${issue("i", 1)}
      ${attempt("subtotal", `update public.invoices set subtotal = 1 where id = '${invoiceId(1)}';`)}
      ${attempt("vat", `update public.invoices set vat = 1 where id = '${invoiceId(1)}';`)}
      ${attempt("total", `update public.invoices set total = 1 where id = '${invoiceId(1)}';`)}
      ${attempt("number", `update public.invoices set invoice_number = 'IS-X' where id = '${invoiceId(1)}';`)}
      ${attempt("due", `update public.invoices set due_date = '2030-01-01' where id = '${invoiceId(1)}';`)}
      ${attempt("issued", `update public.invoices set issue_date = '2030-01-01' where id = '${invoiceId(1)}';`)}
      ${attempt("partner", `update public.invoices set partner_id = '${partnerId(8)}' where id = '${invoiceId(1)}';`)}
      do $$ begin raise notice 'R|s|%', (select subtotal from public.invoices where id = '${invoiceId(1)}'); end $$;`);

    for (const name of ["subtotal", "vat", "total", "number", "due", "issued", "partner"]) {
      expect(get(rows, name), name).toEqual(["IV003"]);
    }
    expect(get(rows, "s")).toEqual(["100.00"]);
  });

  it("should still let an issued invoice move to paid, overdue or void (AC03)", () => {
    const rows = run(`
      ${newPartner(9)}
      ${invoiceOf(1, 9)}
      ${asUser("admin")}
      ${issue("i", 1)}
      ${attempt("overdue", `update public.invoices set status = 'overdue' where id = '${invoiceId(1)}';`)}
      ${attempt("paid", `update public.invoices set status = 'paid' where id = '${invoiceId(1)}';`)}`);

    expect([get(rows, "overdue")[0], get(rows, "paid")[0]]).toEqual(["ok", "ok"]);
  });

  it.each([["issued"], ["paid"], ["overdue"], ["void"]])(
    "should not let an invoice that is %s go back to draft, which would unlock its amounts (AC03)",
    (status) => {
      const rows = run(`
        ${newPartner(13)}
        ${invoiceOf(1, 13, status)}
        ${attempt("back", `update public.invoices set status = 'draft' where id = '${invoiceId(1)}';`)}
        do $$ begin raise notice 'R|s|%', (select status from public.invoices where id = '${invoiceId(1)}'); end $$;`);

      expect(get(rows, "back")).toEqual(["IV003"]);
      expect(get(rows, "s")).toEqual([status]);
    },
  );

  it("should not let a line of an issued invoice be added, changed or deleted (AC03)", () => {
    const rows = run(`
      ${newPartner(10)}
      ${invoiceOf(1, 10)}
      ${asUser("admin")}
      ${issue("i", 1)}
      ${attempt("add", `insert into public.invoice_lines (invoice_id, position, description, amount) values ('${invoiceId(1)}', 2, 'Extra', 1);`)}
      ${attempt("change", `update public.invoice_lines set amount = 1 where invoice_id = '${invoiceId(1)}';`)}
      ${attempt("delete", `delete from public.invoice_lines where invoice_id = '${invoiceId(1)}';`)}
      do $$ begin raise notice 'R|n|%|%', (select count(*) from public.invoice_lines where invoice_id = '${invoiceId(1)}'), (select amount from public.invoice_lines where invoice_id = '${invoiceId(1)}'); end $$;`);

    for (const name of ["add", "change", "delete"]) {
      expect(get(rows, name), name).toEqual(["IV003"]);
    }
    expect(get(rows, "n")).toEqual(["1", "100.00"]);
  });

  it("should still let a draft change its amounts and its lines before it is issued (AC03)", () => {
    const rows = run(`
      ${newPartner(11)}
      ${invoiceOf(1, 11)}
      ${attempt("amount", `update public.invoices set subtotal = 200, total = 205 where id = '${invoiceId(1)}';`)}
      ${attempt("line", `update public.invoice_lines set amount = 200 where invoice_id = '${invoiceId(1)}';`)}
      ${attempt("add", `insert into public.invoice_lines (invoice_id, position, description, amount) values ('${invoiceId(1)}', 2, 'Extra', 1);`)}`);

    expect([get(rows, "amount")[0], get(rows, "line")[0], get(rows, "add")[0]]).toEqual(["ok", "ok", "ok"]);
  });

  it.each([
    ["an operations manager", "operations_manager"],
    ["a partner user", "partner_user"],
    ["a technician", "technician"],
    ["nobody signed in", null],
  ])("should refuse %s with 42501, and leave the draft as it is (AC01)", (_name, role) => {
    const rows = run(`
      ${newPartner(12)}
      ${invoiceOf(1, 12)}
      ${asUser(role)}
      ${issue("i", 1)}
      do $$ begin raise notice 'R|s|%', (select status from public.invoices where id = '${invoiceId(1)}'); end $$;`);

    expect(get(rows, "i")).toEqual(["42501"]);
    expect(get(rows, "s")).toEqual(["draft"]);
  });

  it("should refuse an invoice that does not exist with P0002, and a missing id with 22023", () => {
    const rows = run(`
      ${asUser("admin")}
      do $$ begin perform public.issue_invoice('d5300000-0000-0000-0000-999999999999'); exception when others then raise notice 'R|p|%', sqlstate; end $$;
      do $$ begin perform public.issue_invoice(null); exception when others then raise notice 'R|m|%', sqlstate; end $$;`);

    expect([get(rows, "p")[0], get(rows, "m")[0]]).toEqual(["P0002", "22023"]);
  });
});
