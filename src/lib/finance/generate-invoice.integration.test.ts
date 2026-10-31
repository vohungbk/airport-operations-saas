import { describe, expect, it } from "vitest";

import {
  adjustmentSetup as setup,
  asUser,
  available,
  completeBooking,
  newBooking,
  partnerId,
  run,
} from "@/lib/finance/finance-test-support";

/**
 * VI-F09-S06 (spec R7, R10, E1, E2): the admin generates a draft invoice from an approved settlement, with a
 * number that counts again each year and is never used twice. The rentals are of six days at 75, so 450.00 gross;
 * the terms are 30 percent for the partner, so the platform share is 315.00. Every scenario runs in a transaction
 * that is rolled back. Skipped when the local stack is not running, like the RLS suite.
 */
const D = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} 10:00:00+00`;

/** A completed rental returned on day 7 of the month, six days after its pickup. */
const rental = (n: number, partner: number, year: number, month: number) => `
  ${newBooking(n, partner, D(year, month, 7), "75", D(year, month, 1))}
  ${completeBooking(n)}`;

const settlementOf = (partner: number, month: string) =>
  `(select id from public.settlements where partner_id = '${partnerId(partner)}' and period_start = date '${month}')`;

/** Generates the settlement of a month as the admin and moves it to the given status. */
const settle = (partner: number, month: string, status: "draft" | "pending_approval" | "approved") => `
  ${asUser("admin")}
  select public.generate_monthly_settlement('${partnerId(partner)}', date '${month}');
  ${status === "draft" ? "" : `select public.move_settlement_status(${settlementOf(partner, month)}, 'pending_approval');`}
  ${status === "approved" ? `select public.move_settlement_status(${settlementOf(partner, month)}, 'approved');` : ""}`;

/** Generates an invoice and reports `R|name|ok|number|status|subtotal|vat|total|issue|due` or `R|name|<sqlstate>|<detail>`. */
const invoice = (name: string, partner: number, month: string) => `
  do $$ declare i public.invoices; d text; begin
    i := public.generate_invoice('${partnerId(partner)}', date '${month}');
    raise notice 'R|${name}|ok|%|%|%|%|%|%|%', i.invoice_number, i.status, i.subtotal, i.vat, i.total, i.issue_date, i.due_date;
  exception when others then
    get stacked diagnostics d = pg_exception_detail;
    raise notice 'R|${name}|%|%', sqlstate, coalesce(d, '');
  end $$;`;

/** Reports `R|name|description=amount/counts;...` for the lines of the invoice of a settlement. */
const lines = (name: string, partner: number, month: string) => `
  do $$ begin
    raise notice 'R|${name}|%', (
      select string_agg(l.description || '=' || l.amount || '/' || l.counts_toward_subtotal, ';' order by l.position)
        from public.invoice_lines l
        join public.invoices i on i.id = l.invoice_id
       where i.settlement_id = ${settlementOf(partner, month)});
  end $$;`;

const get = (rows: string[][], name: string) => {
  const row = rows.find((r) => r[0] === name);
  expect(row, name).toBeDefined();
  return row!.slice(1);
};

const counter = (number: string) => Number(number.split("-")[2]);

describe.skipIf(!available)("generating an invoice (VI-F09-S06, spec R7, R10, E1, E2)", () => {
  it("should create a draft with its figures and its lines from an approved settlement (AC04)", () => {
    const rows = run(`
      ${setup(1)} ${rental(1, 1, 2026, 1)}
      ${settle(1, "2026-01-01", "approved")}
      ${invoice("i", 1, "2026-01-15")}
      ${lines("l", 1, "2026-01-01")}`);

    const [ok, number, status, subtotal, vat, total, issue, due] = get(rows, "i");

    expect(ok).toBe("ok");
    expect(number).toMatch(/^INV-2026-\d{6}$/);
    // 315.00 platform share, 5 percent VAT, issued on the first day after the month, due 30 days later.
    expect([status, subtotal, vat, total, issue, due]).toEqual(["draft", "315.00", "15.75", "330.75", "2026-02-01", "2026-03-03"]);
    expect(get(rows, "l")).toEqual(["Gross revenue=450.00/false;Partner share=135.00/false;Platform share=315.00/true"]);
  });

  it("should add the fees to the subtotal, as a line, when the settlement has fees (AC04)", () => {
    const rows = run(`
      ${setup(2)} ${rental(1, 2, 2026, 1)}
      ${asUser("admin")}
      select public.generate_monthly_settlement('${partnerId(2)}', date '2026-01-01');
      update public.settlements set fees = 20.00 where id = ${settlementOf(2, "2026-01-01")};
      select public.move_settlement_status(${settlementOf(2, "2026-01-01")}, 'pending_approval');
      select public.move_settlement_status(${settlementOf(2, "2026-01-01")}, 'approved');
      ${invoice("i", 2, "2026-01-01")}
      ${lines("l", 2, "2026-01-01")}`);

    expect(get(rows, "i").slice(3, 6)).toEqual(["335.00", "16.75", "351.75"]);
    expect(get(rows, "l")[0]).toMatch(/;Fees=20\.00\/true$/);
  });

  it("should give each invoice the next number of the year, never the same twice (AC05)", () => {
    const rows = run(`
      ${setup(3)} ${setup(4)} ${rental(1, 3, 2026, 1)} ${rental(2, 4, 2026, 1)}
      ${settle(3, "2026-01-01", "approved")} ${settle(4, "2026-01-01", "approved")}
      ${invoice("a", 3, "2026-01-01")}
      ${invoice("b", 4, "2026-01-01")}`);

    const [first, second] = [get(rows, "a")[1], get(rows, "b")[1]];

    expect(first).not.toBe(second);
    expect(counter(second) - counter(first)).toBe(1);
  });

  it("should count again from 000001 in a new year, by the year of the issue date (AC05)", () => {
    const rows = run(`
      ${setup(5)} ${rental(1, 5, 2019, 11)} ${rental(2, 5, 2019, 12)}
      ${settle(5, "2019-11-01", "approved")} ${settle(5, "2019-12-01", "approved")}
      ${invoice("nov", 5, "2019-11-01")}
      ${invoice("dec", 5, "2019-12-01")}`);

    // November is issued in December 2019; December is issued on 1 January 2020.
    expect(get(rows, "nov").slice(0, 2)).toEqual(["ok", "INV-2019-000001"]);
    expect(get(rows, "dec").slice(0, 2)).toEqual(["ok", "INV-2020-000001"]);
  });

  it.each([
    ["a draft settlement", "draft" as const],
    ["a settlement that waits for approval", "pending_approval" as const],
  ])("should refuse %s with IN002 and make no invoice (AC09)", (_name, status) => {
    const rows = run(`
      ${setup(6)} ${rental(1, 6, 2026, 1)}
      ${settle(6, "2026-01-01", status)}
      ${invoice("i", 6, "2026-01-01")}
      do $$ begin raise notice 'R|n|%', (select count(*) from public.invoices where partner_id = '${partnerId(6)}'); end $$;`);

    expect(get(rows, "i")[0]).toBe("IN002");
    expect(get(rows, "n")).toEqual(["0"]);
  });

  it("should refuse a month with no settlement at all with IN002 (AC09)", () => {
    const rows = run(`
      ${setup(7)}
      ${asUser("admin")}
      ${invoice("i", 7, "2026-01-01")}`);

    expect(get(rows, "i")[0]).toBe("IN002");
  });

  it("should refuse a second invoice for the same settlement with IN003 and give the first one (AC10)", () => {
    const rows = run(`
      ${setup(8)} ${rental(1, 8, 2026, 1)}
      ${settle(8, "2026-01-01", "approved")}
      ${invoice("first", 8, "2026-01-01")}
      ${invoice("again", 8, "2026-01-20")}
      do $$ begin
        raise notice 'R|id|%', (select id from public.invoices where settlement_id = ${settlementOf(8, "2026-01-01")});
        raise notice 'R|n|%', (select count(*) from public.invoices where settlement_id = ${settlementOf(8, "2026-01-01")});
      end $$;`);

    const [state, existing] = get(rows, "again");

    expect(state).toBe("IN003");
    expect(existing).toBe(get(rows, "id")[0]);
    expect(get(rows, "n")).toEqual(["1"]);
  });

  it("should allow a new invoice once the first one is void, with a number that is not reused (AC05, AC10)", () => {
    const rows = run(`
      ${setup(9)} ${rental(1, 9, 2026, 1)}
      ${settle(9, "2026-01-01", "approved")}
      ${invoice("first", 9, "2026-01-01")}
      update public.invoices set status = 'void' where settlement_id = ${settlementOf(9, "2026-01-01")};
      ${invoice("second", 9, "2026-01-01")}`);

    const [first, second] = [get(rows, "first")[1], get(rows, "second")];

    expect(second[0]).toBe("ok");
    expect(counter(second[1])).toBeGreaterThan(counter(first));
  });

  it.each([
    ["an operations manager", "operations_manager"],
    ["a partner user", "partner_user"],
    ["a technician", "technician"],
    ["nobody signed in", null],
  ])("should refuse %s with 42501 and make no invoice (AC02, AC06)", (_name, role) => {
    const rows = run(`
      ${setup(10)} ${rental(1, 10, 2026, 1)}
      ${settle(10, "2026-01-01", "approved")}
      ${asUser(role)}
      ${invoice("i", 10, "2026-01-01")}
      do $$ begin raise notice 'R|n|%', (select count(*) from public.invoices where partner_id = '${partnerId(10)}'); end $$;`);

    expect(get(rows, "i")[0]).toBe("42501");
    expect(get(rows, "n")).toEqual(["0"]);
  });

  it("should refuse a partner that does not exist with P0002, and a missing value with 22023 (AC03)", () => {
    const rows = run(`
      ${asUser("admin")}
      do $$ begin perform public.generate_invoice('d5000000-0000-0000-0000-999999999999', date '2026-01-01'); exception when others then raise notice 'R|p|%', sqlstate; end $$;
      do $$ begin perform public.generate_invoice(null, date '2026-01-01'); exception when others then raise notice 'R|m|%', sqlstate; end $$;`);

    expect(get(rows, "p")).toEqual(["P0002"]);
    expect(get(rows, "m")).toEqual(["22023"]);
  });
});
