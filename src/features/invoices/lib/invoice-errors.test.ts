import { describe, expect, it } from "vitest";

import { INTERNAL_ERROR, mapInvoiceError } from "@/features/invoices/lib/invoice-errors";

describe("mapInvoiceError (VI-F09-S06, AC09, AC10)", () => {
  it("should say the settlement is not approved for IN002, on the month", () => {
    expect(mapInvoiceError({ code: "IN002" })).toEqual({
      code: "SETTLEMENT_NOT_APPROVED",
      message: "Select a period with an approved settlement.",
      field: "month",
    });
  });

  it("should give the existing invoice for IN003, so the screen can show it", () => {
    expect(mapInvoiceError({ code: "IN003", details: "d9100000-0000-0000-0000-000000000001" })).toEqual({
      code: "CONFLICT",
      message: "An invoice for this period already exists.",
      field: "month",
      existing_invoice_id: "d9100000-0000-0000-0000-000000000001",
    });
  });

  it("should still be a conflict when the database gives no invoice id", () => {
    expect(mapInvoiceError({ code: "IN003", details: null })).not.toHaveProperty("existing_invoice_id");
  });

  it.each([
    ["42501", "FORBIDDEN"],
    ["P0002", "NOT_FOUND"],
    ["22023", "VALIDATION_ERROR"],
  ])("should map %s to %s", (code, expected) => {
    expect(mapInvoiceError({ code }).code).toBe(expected);
  });

  it("should never show a raw database error: anything else is the generic error", () => {
    expect(mapInvoiceError({ code: "XX000", details: "connection to db.internal refused" })).toEqual(INTERNAL_ERROR);
  });
});
