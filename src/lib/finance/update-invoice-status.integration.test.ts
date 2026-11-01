import { describe, expect, it } from "vitest";

import { asUser, available, newPartner, partnerId, run, USER } from "@/lib/finance/finance-test-support";

/**
 * VI-F09-S08 (spec F1, V1, R6, R16, E3, E7): the admin updates the payment status of an invoice by hand. Only the
 * allowed moves are made, a void needs a reason and keeps the number, and finance history keeps who made the change,
 * when and why. Every scenario runs in a transaction that is rolled back. Skipped when the local stack is not running,
 * like the RLS suite.
 */
const invoiceId = (n: number) => `d5400000-0000-0000-0000-${String(n).padStart(12, "0")}`;

/** An invoice of a partner with one line, made while it is a draft (its lines are locked after), then moved to the status asked for. */
const invoiceOf = (n: number, partner: number, status = "issued") => `
  insert into public.invoices (id, partner_id, invoice_number, issue_date, due_date, subtotal, vat, total, status)
  values ('${invoiceId(n)}', '${partnerId(partner)}', 'US-${n}', '2026-01-01', '2026-01-31', 100, 5, 105, 'draft');
  insert into public.invoice_lines (invoice_id, position, description, amount, counts_toward_subtotal)
  values ('${invoiceId(n)}', 1, 'Platform share', 100, true);
  update public.invoices set status = '${status}' where id = '${invoiceId(n)}';`;

/** Updates the status and reports `R|name|ok|status` or `R|name|<sqlstate>`. */
const update = (name: string, n: number, to: string, reason: string | null = null) => `
  do $$ declare i public.invoices; begin
    i := public.update_invoice_status('${invoiceId(n)}', '${to}'${reason === null ? "" : `, '${reason}'`});
    raise notice 'R|${name}|ok|%', i.status;
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

/** Reports `R|name|<status>|<number>` of the invoice. */
const state = (name: string, n: number) => `
  do $$ begin raise notice 'R|${name}|%|%', (select status from public.invoices where id = '${invoiceId(n)}'),
    (select invoice_number from public.invoices where id = '${invoiceId(n)}'); end $$;`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

describe.skipIf(!available)("updating the payment status of an invoice (VI-F09-S08, spec F1, V1, R6, E3, E7)", () => {
  it.each([
    ["issued", "paid"],
    ["issued", "overdue"],
    ["issued", "void"],
    ["overdue", "paid"],
    ["overdue", "void"],
  ])("should move an invoice from %s to %s (AC03)", (from, to) => {
    const rows = run(`
      ${newPartner(1)}
      ${invoiceOf(1, 1, from)}
      ${asUser("admin")}
      ${update("u", 1, to, "A reason")}`);

    expect(get(rows, "u")).toEqual(["ok", to]);
  });

  it.each([
    ["paid", "issued"],
    ["paid", "void"],
    ["void", "issued"],
    ["void", "paid"],
    ["overdue", "issued"],
    ["issued", "issued"],
    ["issued", "draft"],
    ["draft", "paid"],
    ["draft", "issued"],
  ])("should refuse the move from %s to %s with IV004 and leave the status as it was (AC04)", (from, to) => {
    const rows = run(`
      ${newPartner(2)}
      ${invoiceOf(2, 2, from)}
      ${asUser("admin")}
      ${update("u", 2, to, "A reason")}
      ${state("s", 2)}`);

    expect(get(rows, "u")).toEqual(["IV004"]);
    expect(get(rows, "s")[0]).toBe(from);
  });

  it("should keep who changed the status, when and why in the finance history (AC03)", () => {
    const rows = run(`
      ${newPartner(3)}
      ${invoiceOf(3, 3)}
      ${asUser("admin")}
      ${update("u", 3, "paid", "Bank transfer received")}
      do $$ declare h record; begin
        select * into h from public.finance_history
         where row_id = '${invoiceId(3)}' and new_values ->> 'status' = 'paid';
        raise notice 'R|h|%|%|%|%|%', h.reason, h.changed_by::text = ${USER("admin")}, h.changed_at is not null,
          h.old_values ->> 'status', h.new_values ->> 'status';
      end $$;`);

    expect(get(rows, "h")).toEqual(["Bank transfer received", "t", "t", "issued", "paid"]);
  });

  it("should say the move in the history when no reason is given (AC03)", () => {
    const rows = run(`
      ${newPartner(4)}
      ${invoiceOf(4, 4)}
      ${asUser("admin")}
      ${update("u", 4, "overdue")}
      do $$ begin raise notice 'R|h|%', (select reason from public.finance_history
        where row_id = '${invoiceId(4)}' and new_values ->> 'status' = 'overdue'); end $$;`);

    expect(get(rows, "h")).toEqual(["Invoice status moved from issued to overdue"]);
  });

  it("should void with a reason and keep the number and the amounts (AC05)", () => {
    const rows = run(`
      ${newPartner(5)}
      ${invoiceOf(5, 5)}
      ${asUser("admin")}
      ${update("u", 5, "void", "Issued to the wrong partner")}
      ${state("s", 5)}
      do $$ begin raise notice 'R|h|%|%', (select reason from public.finance_history
        where row_id = '${invoiceId(5)}' and new_values ->> 'status' = 'void'),
        (select total from public.invoices where id = '${invoiceId(5)}'); end $$;`);

    expect(get(rows, "u")).toEqual(["ok", "void"]);
    expect(get(rows, "s")).toEqual(["void", "US-5"]);
    expect(get(rows, "h")).toEqual(["Issued to the wrong partner", "105.00"]);
  });

  it.each([
    ["no reason", null],
    ["a reason of spaces", "   "],
  ])("should refuse a void with %s with IV005 and leave the invoice as it was (AC05)", (_name, reason) => {
    const rows = run(`
      ${newPartner(6)}
      ${invoiceOf(6, 6)}
      ${asUser("admin")}
      ${update("u", 6, "void", reason)}
      ${state("s", 6)}`);

    expect(get(rows, "u")).toEqual(["IV005"]);
    expect(get(rows, "s")[0]).toBe("issued");
  });

  it("should refuse a reason longer than 1000 characters with IV005 (AC02)", () => {
    const rows = run(`
      ${newPartner(7)}
      ${invoiceOf(7, 7)}
      ${asUser("admin")}
      ${update("u", 7, "paid", "a".repeat(1001))}
      ${update("ok", 7, "paid", "a".repeat(1000))}`);

    expect([get(rows, "u")[0], get(rows, "ok")[0]]).toEqual(["IV005", "ok"]);
  });

  it("should not let the status be changed with a direct update, which would skip the rules (AC02)", () => {
    const rows = run(`
      ${newPartner(8)}
      ${invoiceOf(8, 8)}
      ${attempt("direct", `update public.invoices set status = 'paid' where id = '${invoiceId(8)}';`)}
      ${attempt("back", `update public.invoices set status = 'draft' where id = '${invoiceId(8)}';`)}
      ${state("s", 8)}`);

    expect([get(rows, "direct")[0], get(rows, "back")[0]]).toEqual(["IV004", "IV003"]);
    expect(get(rows, "s")[0]).toBe("issued");
  });

  it("should not let the amounts of an invoice change through the status update (AC05)", () => {
    const rows = run(`
      ${newPartner(9)}
      ${invoiceOf(9, 9)}
      ${asUser("admin")}
      ${update("u", 9, "paid")}
      ${attempt("amount", `update public.invoices set total = 1 where id = '${invoiceId(9)}';`)}`);

    expect([get(rows, "u")[0], get(rows, "amount")[0]]).toEqual(["ok", "IV003"]);
  });

  it.each([
    ["an operations manager", "operations_manager"],
    ["a partner user", "partner_user"],
    ["a technician", "technician"],
    ["nobody signed in", null],
  ])("should refuse %s with 42501, and leave the invoice as it is (AC02)", (_name, role) => {
    const rows = run(`
      ${newPartner(10)}
      ${invoiceOf(10, 10)}
      ${asUser(role)}
      ${update("u", 10, "paid")}
      ${state("s", 10)}`);

    expect(get(rows, "u")).toEqual(["42501"]);
    expect(get(rows, "s")[0]).toBe("issued");
  });

  it("should refuse an invoice that does not exist with P0002, and a missing id or status with 22023", () => {
    const rows = run(`
      ${asUser("admin")}
      do $$ begin perform public.update_invoice_status('d5400000-0000-0000-0000-999999999999', 'paid'); exception when others then raise notice 'R|p|%', sqlstate; end $$;
      do $$ begin perform public.update_invoice_status(null, 'paid'); exception when others then raise notice 'R|m|%', sqlstate; end $$;
      do $$ begin perform public.update_invoice_status('${invoiceId(1)}', null); exception when others then raise notice 'R|n|%', sqlstate; end $$;`);

    expect([get(rows, "p")[0], get(rows, "m")[0], get(rows, "n")[0]]).toEqual(["P0002", "22023", "22023"]);
  });
});
