import { describe, expect, it } from "vitest";

import { invoiceHistoryQuerySchema } from "@/features/invoices/schemas/invoice-history-query.schema";

const ID = "d5600000-0000-0000-0000-000000000001";

describe("invoiceHistoryQuerySchema (VI-F09-S10)", () => {
  it("should read an invoice and a year", () => {
    expect(invoiceHistoryQuerySchema.parse({ invoice_id: ID, year: "2026" })).toEqual({ invoice_id: ID, year: 2026 });
  });

  it("should leave both out when they are not given", () => {
    expect(invoiceHistoryQuerySchema.parse({})).toEqual({});
  });

  it.each(["not-an-id", "1; drop table invoices", ""])("should ignore the invoice %j instead of failing", (value) => {
    expect(invoiceHistoryQuerySchema.parse({ invoice_id: value }).invoice_id).toBeUndefined();
  });

  it.each(["abc", "1999", "2101", "2026.5", ""])("should ignore the year %j instead of failing", (value) => {
    expect(invoiceHistoryQuerySchema.parse({ year: value }).year).toBeUndefined();
  });
});
