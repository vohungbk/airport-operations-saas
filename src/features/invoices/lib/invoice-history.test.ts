import { describe, expect, it } from "vitest";

import {
  buildHistoryEvents,
  buildInvoiceHistoryHref,
  currentHistoryYear,
  formatHistoryTime,
  historyEventLabel,
  historyYears,
  invoiceNumberSuffix,
  type InvoiceHistoryRow,
} from "@/features/invoices/lib/invoice-history";

const ROW: InvoiceHistoryRow = {
  id: "h-1",
  invoice_id: "i-1",
  invoice_number: "INV-2026-000031",
  from_status: "draft",
  to_status: "issued",
  reason: "Invoice status moved from draft to issued",
  actor_name: "Aisha Khan",
  changed_at: "2026-09-01T06:00:00Z",
};

describe("invoice history events (VI-F09-S10)", () => {
  it.each([
    [null, "draft", "Generated"],
    ["draft", "issued", "Issued"],
    ["issued", "overdue", "Marked overdue"],
    ["overdue", "paid", "Paid"],
    ["issued", "void", "Voided"],
  ])("should call a move from %s to %s %s", (from, to, label) => {
    expect(historyEventLabel(from, to)).toBe(label);
  });

  it("should fall back to the status name for a status without a label of its own", () => {
    expect(historyEventLabel("issued", "draft")).toBe("Draft");
  });

  it("should show the end of the invoice number, and the whole number when it has no dash", () => {
    expect(invoiceNumberSuffix("INV-2026-000031")).toBe("000031");
    expect(invoiceNumberSuffix("LEGACY")).toBe("LEGACY");
  });

  it("should show the time in GST, four hours ahead of UTC", () => {
    expect(formatHistoryTime("2026-09-01T05:00:00Z")).toBe("01 Sep 2026, 09:00 GST");
  });

  it("should build the events in the order given, with System for a change nobody made", () => {
    const events = buildHistoryEvents([ROW, { ...ROW, id: "h-2", to_status: "overdue", actor_name: null }]);

    expect(events.map((e) => e.title)).toEqual(["Issued / 000031", "Marked overdue / 000031"]);
    expect(events.map((e) => e.actor)).toEqual(["Aisha Khan", "System"]);
    expect(events[0].note).toBe("Invoice status moved from draft to issued");
  });

  it("should give no events for no rows", () => {
    expect(buildHistoryEvents([])).toEqual([]);
  });
});

describe("invoice history fields (VI-F09-S10)", () => {
  it("should list the years from the oldest issue date to this year, newest first", () => {
    expect(historyYears(["2024-03-01", "2026-01-15"], 2026)).toEqual([2026, 2025, 2024]);
  });

  it("should list only this year when there is no invoice, or an invoice with a bad date", () => {
    expect(historyYears([], 2026)).toEqual([2026]);
    expect(historyYears(["not-a-date"], 2026)).toEqual([2026]);
  });

  it("should take the year in Dubai, which is ahead of UTC", () => {
    expect(currentHistoryYear(new Date("2026-12-31T21:00:00Z"))).toBe(2027);
    expect(currentHistoryYear(new Date("2026-12-31T19:00:00Z"))).toBe(2026);
  });

  it("should build the address with the invoice and the year only when they are given", () => {
    expect(buildInvoiceHistoryHref({})).toBe("/invoices/history");
    expect(buildInvoiceHistoryHref({ year: 2026 })).toBe("/invoices/history?year=2026");
    expect(buildInvoiceHistoryHref({ invoice_id: "i-1", year: 2025 })).toBe("/invoices/history?invoice_id=i-1&year=2025");
  });
});
