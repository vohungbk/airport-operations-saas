import { describe, expect, it } from "vitest";

import {
  buildInvoiceRows,
  formatInvoiceAmount,
  formatInvoiceDate,
  formatShortMonth,
  overdueDays,
  showingText,
  visibleInvoiceStatuses,
  type InvoiceListRow,
} from "@/features/invoices/lib/invoice-list";

const ROW: InvoiceListRow = {
  id: "i-1",
  invoice_number: "INV-2026-000042",
  partner: { name: "Emirates Rent A Car", code: "EMR" },
  period_start: "2026-09-01",
  issue_date: "2026-09-30",
  due_date: "2026-10-18",
  total: 1450,
  status: "overdue",
};

describe("formatters", () => {
  it("should write the amount, the date and the month as the design does", () => {
    expect(formatInvoiceAmount(2400)).toBe("USD 2,400.00");
    expect(formatInvoiceAmount(0.5)).toBe("USD 0.50");
    expect(formatInvoiceDate("2026-11-15")).toBe("15 Nov 2026");
    expect(formatInvoiceDate("2026-09-05")).toBe("5 Sep 2026");
    expect(formatShortMonth("2026-09-01")).toBe("Sep 2026");
  });
});

describe("overdueDays", () => {
  it("should count the whole days past the due date", () => {
    expect(overdueDays("2026-10-18", "2026-10-30")).toBe(12);
  });

  it.each([["the day it is due", "2026-10-30"], ["before it is due", "2026-11-15"]])("should be null %s", (_name, due) => {
    expect(overdueDays(due, "2026-10-30")).toBeNull();
  });

  it("should be null for a date that cannot be read", () => {
    expect(overdueDays("not a date", "2026-10-30")).toBeNull();
  });
});

describe("visibleInvoiceStatuses", () => {
  it("should hide draft and void from a partner user, and show every status to an operations user (the status filter lists these)", () => {
    expect(visibleInvoiceStatuses(true)).toEqual(["issued", "paid", "overdue"]);
    expect(visibleInvoiceStatuses(false)).toEqual(["draft", "issued", "paid", "overdue", "void"]);
  });
});

describe("buildInvoiceRows (VI-F09-S01)", () => {
  it("should write each row with its period, amount and due date", () => {
    const [row] = buildInvoiceRows([ROW], "2026-10-30");

    expect(row).toMatchObject({
      invoice_number: "INV-2026-000042",
      partner: "Emirates Rent A Car",
      period: "Sep 2026",
      amount: "USD 1,450.00",
      due_date: "18 Oct 2026",
      status: "overdue",
    });
  });

  it("should say how many days an overdue invoice is late", () => {
    expect(buildInvoiceRows([ROW], "2026-10-30")[0].overdue_note).toBe("Overdue by 12 days");
    expect(buildInvoiceRows([ROW], "2026-10-19")[0].overdue_note).toBe("Overdue by 1 day");
  });

  it("should not add a note to an invoice that is not overdue, even when its due date has passed", () => {
    expect(buildInvoiceRows([{ ...ROW, status: "issued" }], "2026-10-30")[0].overdue_note).toBeNull();
  });

  it("should show a dash for an invoice with no settlement and no partner", () => {
    const [row] = buildInvoiceRows([{ ...ROW, period_start: null, partner: null }], "2026-10-30");

    expect(row.period).toBe("—");
    expect(row.partner).toBeNull();
  });
});

describe("showingText", () => {
  it("should write the range the page shows", () => {
    expect(showingText(1, 10, 9)).toBe("Showing 1–9 of 9");
    expect(showingText(2, 10, 25)).toBe("Showing 11–20 of 25");
    expect(showingText(3, 10, 25)).toBe("Showing 21–25 of 25");
    expect(showingText(1, 10, 0)).toBe("Showing 0 of 0");
  });
});
