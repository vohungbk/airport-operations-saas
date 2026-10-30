import { describe, expect, it } from "vitest";

import { buildInvoiceDetail, vatRate, type InvoiceDetailRow } from "@/features/invoices/lib/invoice-detail";

const LINES: InvoiceDetailRow["lines"] = [
  { position: 1, description: "Gross revenue", amount: 8000, counts_toward_subtotal: false },
  { position: 2, description: "Partner share", amount: 4800, counts_toward_subtotal: false },
  { position: 3, description: "Platform share", amount: 3200, counts_toward_subtotal: true },
  { position: 4, description: "Refunds (credit)", amount: -150, counts_toward_subtotal: true },
  { position: 5, description: "Adjustments", amount: 0, counts_toward_subtotal: true },
  { position: 6, description: "Onboarding credits", amount: -500, counts_toward_subtotal: true },
  { position: 7, description: "Annual programme fee", amount: 2500, counts_toward_subtotal: true },
];

const ROW: InvoiceDetailRow = {
  id: "i-1",
  invoice_number: "INV-2026-000045",
  issue_date: "2026-10-01",
  due_date: "2026-10-31",
  subtotal: 5050,
  vat: 252.5,
  total: 5302.5,
  status: "issued",
  partner: { name: "Emirates Rent A Car", code: "EMR" },
  period_start: "2026-09-01",
  lines: LINES,
};

describe("buildInvoiceDetail (VI-F09-S03)", () => {
  const view = buildInvoiceDetail(ROW, true);

  it("should write who, which month and when under the number", () => {
    expect(view.invoice_number).toBe("INV-2026-000045");
    expect(view.meta).toBe("Emirates Rent A Car / September 2026 / Issued 01 Oct 2026 / Due 31 Oct 2026");
  });

  it("should leave the partner out for a partner user, who knows whose invoice it is", () => {
    expect(buildInvoiceDetail(ROW, false).meta).toBe("September 2026 / Issued 01 Oct 2026 / Due 31 Oct 2026");
  });

  it("should write the three cards of the design: the amount, the due date with its terms, the VAT with its rate", () => {
    expect(view.cards).toEqual([
      { label: "Amount due", value: "USD 5,302.50", caption: "Invoice total, including VAT" },
      { label: "Due date", value: "31 Oct 2026", caption: "Payment terms: 30 days" },
      { label: "VAT / 5%", value: "USD 252.50", caption: "Subtotal USD 5,050.00" },
    ]);
  });

  it("should write each line, then the subtotal, the VAT and the total of the invoice", () => {
    expect(view.lines.map((line) => [line.description, line.amount])).toEqual([
      ["Gross revenue", "$8,000.00"],
      ["Partner share", "$4,800.00"],
      ["Platform share", "$3,200.00"],
      ["Refunds (credit)", "-$150.00"],
      ["Adjustments", "$0.00"],
      ["Onboarding credits", "-$500.00"],
      ["Annual programme fee", "$2,500.00"],
      ["Subtotal", "$5,050.00"],
      ["VAT 5%", "$252.50"],
      ["Total USD", "$5,302.50"],
    ]);
  });

  it("should mark a credit as negative and the rows under the lines as totals", () => {
    expect(view.lines.filter((line) => line.negative).map((line) => line.description)).toEqual(["Refunds (credit)", "Onboarding credits"]);
    expect(view.lines.filter((line) => line.is_total).map((line) => line.description)).toEqual(["Subtotal", "VAT 5%", "Total USD"]);
  });

  it("should explain the total from the lines that make up the subtotal, in their order, when they add up", () => {
    expect(view.explanation).toBe(
      "How this total is calculated: 3,200.00 platform share - 150.00 refunds - 500.00 onboarding credits + 2,500.00 annual programme fee = 5,050.00; + VAT 252.50 = USD 5,302.50.",
    );
  });

  it("should write no explanation when the lines do not add up to the subtotal, rather than one that is wrong", () => {
    expect(buildInvoiceDetail({ ...ROW, subtotal: 5000 }, true).explanation).toBeNull();
  });

  it("should say whether a line was recorded", () => {
    expect(view.has_lines).toBe(true);
    expect(buildInvoiceDetail({ ...ROW, lines: [] }, true).has_lines).toBe(false);
  });

  it("should write no explanation when no line makes up the subtotal", () => {
    expect(buildInvoiceDetail({ ...ROW, lines: [] }, true).explanation).toBeNull();
    expect(buildInvoiceDetail({ ...ROW, lines: LINES.slice(0, 2) }, true).explanation).toBeNull();
  });

  it("should add the cents up exactly", () => {
    const row = { ...ROW, subtotal: 0.3, lines: [{ position: 1, description: "A", amount: 0.1, counts_toward_subtotal: true }, { position: 2, description: "B", amount: 0.2, counts_toward_subtotal: true }] };

    expect(buildInvoiceDetail(row, true).explanation).toContain("= 0.30;");
  });
});

describe("vatRate", () => {
  it("should read the rate off the figures, with no trailing zero", () => {
    expect(vatRate(5050, 252.5)).toBe("5");
    expect(vatRate(1000, 62.5)).toBe("6.25");
  });

  it("should give no rate when there is no subtotal to take it of", () => {
    expect(vatRate(0, 0)).toBeNull();
    expect(buildInvoiceDetail({ ...ROW, subtotal: 0, vat: 0, total: 0, lines: [] }, true).cards[2].label).toBe("VAT");
  });
});

describe("payment status", () => {
  const steps = (status: InvoiceDetailRow["status"]) => buildInvoiceDetail({ ...ROW, status }, true);

  it.each([
    ["draft", ["current", "upcoming", "upcoming"], "Current: Draft"],
    ["issued", ["done", "current", "upcoming"], "Current: Issued"],
    ["paid", ["done", "done", "current"], "Current: Paid"],
  ] as const)("should put a %s invoice on the right step", (status, expected, current) => {
    expect(steps(status).steps.map((step) => step.state)).toEqual(expected);
    expect(steps(status).current).toBe(current);
  });

  it("should keep an overdue invoice on Issued and mark Overdue as its side state", () => {
    const view = steps("overdue");

    expect(view.steps.map((step) => step.state)).toEqual(["done", "current", "upcoming"]);
    expect(view.side_states).toEqual([{ label: "Overdue", active: true }, { label: "Void", active: false }]);
    expect(view.current).toBe("Current: Overdue");
  });

  it("should put a void invoice on no step and mark Void as its side state", () => {
    const view = steps("void");

    expect(view.steps.every((step) => step.state === "upcoming")).toBe(true);
    expect(view.side_states[1]).toEqual({ label: "Void", active: true });
  });

  it("should call the amount what the invoice is: due, paid or the total", () => {
    expect(steps("paid").cards[0].label).toBe("Amount paid");
    expect(steps("void").cards[0].label).toBe("Invoice total");
    expect(steps("overdue").cards[0].label).toBe("Amount due");
  });
});

describe("payment terms", () => {
  it("should be the days from the issue date to the due date, in the singular for one", () => {
    expect(buildInvoiceDetail({ ...ROW, due_date: "2026-10-02" }, true).cards[1].caption).toBe("Payment terms: 1 day");
  });

  it("should be a dash when the due date is before the issue date", () => {
    expect(buildInvoiceDetail({ ...ROW, due_date: "2026-09-01" }, true).cards[1].caption).toBe("Payment terms: —");
  });
});

describe("an invoice with no settlement and no partner", () => {
  it("should leave the month out of the line under the number and show a dash for the partner", () => {
    expect(buildInvoiceDetail({ ...ROW, partner: null, period_start: null }, true).meta).toBe("— / Issued 01 Oct 2026 / Due 31 Oct 2026");
  });
});
