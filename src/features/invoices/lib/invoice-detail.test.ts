import { describe, expect, it } from "vitest";

import { buildInvoiceDetail, type InvoiceDetailRow } from "@/features/invoices/lib/invoice-detail";

const ROW: InvoiceDetailRow = {
  id: "i-1",
  invoice_number: "INV-2026-000018",
  issue_date: "2026-10-31",
  due_date: "2026-11-14",
  subtotal: 5650,
  vat: 282.5,
  total: 5932.5,
  status: "issued",
  partner: { name: "Emirates Rent A Car", code: "EMR" },
  period_start: "2026-10-01",
};

const value = (lines: Array<{ label: string; value: string }>, label: string) => lines.find((line) => line.label === label)?.value;

describe("buildInvoiceDetail (VI-F09-S01, NAV-1)", () => {
  const view = buildInvoiceDetail(ROW, "2026-10-30");

  it("should write the figures the database stored", () => {
    expect(view.invoice_number).toBe("INV-2026-000018");
    expect(value(view.lines, "Subtotal")).toBe("USD 5,650.00");
    expect(value(view.lines, "VAT")).toBe("USD 282.50");
    expect(value(view.lines, "Total")).toBe("USD 5,932.50");
    expect(value(view.lines, "Due date")).toBe("14 Nov 2026");
    expect(value(view.lines, "Payment status")).toBe("Issued");
    expect(value(view.lines, "Partner")).toBe("Emirates Rent A Car (EMR)");
    expect(value(view.lines, "Period")).toBe("Oct 2026");
  });

  it("should say how late an overdue invoice is", () => {
    const late = buildInvoiceDetail({ ...ROW, status: "overdue", due_date: "2026-10-18" }, "2026-10-30");

    expect(value(late.lines, "Due date")).toBe("18 Oct 2026 (overdue by 12 days)");
  });

  it("should show a dash for an invoice with no settlement and no partner", () => {
    const bare = buildInvoiceDetail({ ...ROW, partner: null, period_start: null }, "2026-10-30");

    expect(value(bare.lines, "Partner")).toBe("—");
    expect(value(bare.lines, "Period")).toBe("—");
  });
});
