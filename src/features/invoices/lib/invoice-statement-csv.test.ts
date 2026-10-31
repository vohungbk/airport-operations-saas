import { describe, expect, it } from "vitest";

import {
  invoiceStatementFileName,
  statementCsvLines,
  statementCsvStart,
  type StatementBooking,
} from "@/features/invoices/lib/invoice-statement-csv";

const BOOKING: StatementBooking = {
  booking_number: "BK-2026-000101",
  revenue_case: "standard",
  paid_days: 3,
  gross_revenue: 90,
  partner_share: 63,
  platform_share: 27,
  launch_credit: 0,
  adjustments_total: -10.5,
  return_at: "2026-09-12T10:00:00+00:00",
  actual_return_at: null,
};

describe("statement CSV (VI-F09-S05, AC01)", () => {
  it("should start with the UTF-8 mark and the header, and hold only the header for a statement with no booking", () => {
    const start = statementCsvStart();

    expect(start.startsWith("﻿Booking number,Returned,Case,Paid days,")).toBe(true);
    expect(start.endsWith("\r\n")).toBe(true);
    expect(statementCsvLines([])).toBe("");
  });

  it("should write a booking as a line of plain numbers and a day", () => {
    expect(statementCsvLines([BOOKING])).toBe("BK-2026-000101,2026-09-12,Standard,3,90.00,63.00,27.00,0.00,-10.50\r\n");
  });

  it("should date a rental by the day it was really returned, in UTC, and name an early return", () => {
    const line = statementCsvLines([
      { ...BOOKING, revenue_case: "early_return", actual_return_at: "2026-09-30T23:30:00+00:00", return_at: "2026-10-02T10:00:00+00:00" },
    ]);

    expect(line).toContain(",2026-09-30,Early return,");
  });

  it("should leave an amount empty when the database holds none", () => {
    expect(statementCsvLines([{ ...BOOKING, partner_share: null, platform_share: null }])).toContain(",90.00,,,0.00,");
  });

  it("should not let a booking number that looks like a formula run in a spreadsheet", () => {
    expect(statementCsvLines([{ ...BOOKING, booking_number: "=HYPERLINK(1)" }]).startsWith("'=HYPERLINK(1),")).toBe(true);
  });

  it("should make a number that is not safe in a file name safe", () => {
    expect(invoiceStatementFileName("INV-2026-000045")).toBe("INV-2026-000045-statement.csv");
    expect(invoiceStatementFileName('INV"\r\nX')).toBe("INV___X-statement.csv");
  });
});
