import { describe, expect, it } from "vitest";

import {
  buildPartnerFinance,
  formatInvoiceTotal,
  formatIssueDate,
  formatMonth,
  formatTileAmount,
  summarizeOpenInvoices,
  type FinanceInvoice,
  type FinanceTerms,
} from "@/features/partners/lib/partner-finance";

const SETTLEMENT = {
  period_start: "2026-10-01",
  gross_revenue: 12000,
  partner_share: 6000,
  final_amount: 5670,
};

const TERMS: FinanceTerms = {
  partner_share_percent: 30,
  launch_partner_share_percent: 50,
  launch_mode: true,
  launch_credit_target: 5000,
  launch_credit_accumulated: 1200,
};

const invoice = (overrides: Partial<FinanceInvoice>): FinanceInvoice => ({
  id: "i-1",
  invoice_number: "INV-2026-0010",
  issue_date: "2026-10-31",
  total: 5953.5,
  status: "issued",
  period_start: "2026-10-01",
  ...overrides,
});

const INVOICES: FinanceInvoice[] = [
  invoice({}),
  invoice({ id: "i-2", invoice_number: "INV-2026-0009", issue_date: "2026-09-30", total: 4830, status: "paid", period_start: "2026-09-01" }),
  invoice({ id: "i-3", invoice_number: "INV-2026-0008", issue_date: "2026-08-31", total: 1260, status: "overdue", period_start: "2026-08-01" }),
];

describe("formatters", () => {
  it("should write a whole tile amount with no cents and an amount with cents with two decimals", () => {
    expect(formatTileAmount(12000)).toBe("$12,000");
    expect(formatTileAmount(5670.5)).toBe("$5,670.50");
    expect(formatTileAmount(0)).toBe("$0");
  });

  it("should write the total of an invoice with two decimals", () => {
    expect(formatInvoiceTotal(5953.5)).toBe("USD 5,953.50");
    expect(formatInvoiceTotal(1260)).toBe("USD 1,260.00");
  });

  it("should write the month and the issue date as the design does", () => {
    expect(formatMonth("2026-10-01")).toBe("October 2026");
    expect(formatIssueDate("2026-09-30")).toBe("30 Sep 2026");
    expect(formatIssueDate("2026-10-05")).toBe("5 Oct 2026");
  });
});

describe("summarizeOpenInvoices", () => {
  it("should count only the issued and overdue invoices, and sum them exactly", () => {
    expect(summarizeOpenInvoices(INVOICES)).toEqual({ count: 2, value: 7213.5 });
    expect(
      summarizeOpenInvoices([invoice({ total: 0.1 }), invoice({ id: "i-9", total: 0.2 })]).value,
    ).toBe(0.3);
  });

  it("should be zero when every invoice is paid", () => {
    expect(summarizeOpenInvoices([invoice({ status: "paid" })])).toEqual({ count: 0, value: 0 });
  });
});

describe("buildPartnerFinance (VI-F04-S14, AC02)", () => {
  const view = buildPartnerFinance({ settlement: SETTLEMENT, invoices: INVOICES, terms: TERMS });

  it("should show the revenue, the share and the payable amount of the latest settlement", () => {
    expect(view.tiles.slice(0, 3)).toEqual([
      { label: "Gross revenue", value: "$12,000", caption: "USD · October 2026" },
      { label: "Partner share", value: "$6,000", caption: "USD · Launch share 50%" },
      { label: "Amount payable", value: "$5,670", caption: "USD · Before VAT" },
    ]);
  });

  it("should show the value and the count of the open invoices", () => {
    expect(view.tiles[3]).toEqual({
      label: "Outstanding invoices",
      value: "$7,213.50",
      caption: "USD · 2 open invoices",
    });
  });

  it("should list every invoice with its period, issue date, total and status", () => {
    expect(view.invoices[2]).toEqual({
      id: "i-3",
      invoice_number: "INV-2026-0008",
      period: "August 2026",
      issued: "31 Aug 2026",
      total: "USD 1,260.00",
      status: "Overdue",
    });
  });

  it("should carry the launch credit of the terms in use", () => {
    expect(view.launch_credit).toEqual({ accumulated: 1200, target: 5000 });
  });

  it("should name the standard share when launch terms are not active", () => {
    const standard = buildPartnerFinance({
      settlement: SETTLEMENT,
      invoices: [],
      terms: { ...TERMS, launch_mode: false },
    });

    expect(standard.tiles[1].caption).toBe("USD · Standard share 30%");
  });

  it("should say '1 open invoice' in the singular", () => {
    const one = buildPartnerFinance({ settlement: null, invoices: [INVOICES[0]], terms: null });

    expect(one.tiles[3].caption).toBe("USD · 1 open invoice");
  });

  it("should show a dash, not a made-up number, when there is no settlement yet", () => {
    const noSettlement = buildPartnerFinance({ settlement: null, invoices: INVOICES, terms: TERMS });

    expect(noSettlement.tiles.slice(0, 3).map((tile) => tile.value)).toEqual(["—", "—", "—"]);
    expect(noSettlement.is_empty).toBe(false);
  });

  it("should show a dash as the period of an invoice with no settlement", () => {
    const orphan = buildPartnerFinance({
      settlement: null,
      invoices: [invoice({ period_start: null })],
      terms: null,
    });

    expect(orphan.invoices[0].period).toBe("—");
  });

  it("should have no launch target and no credit when the partner has no terms", () => {
    const empty = buildPartnerFinance({ settlement: null, invoices: [], terms: null });

    expect(empty.launch_credit).toEqual({ accumulated: 0, target: null });
    expect(empty.is_empty).toBe(true);
  });
});
