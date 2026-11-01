import { describe, expect, it } from "vitest";

import {
  INTERNAL_ERROR,
  ISSUE_INTERNAL_ERROR,
  STATUS_INTERNAL_ERROR,
  mapInvoiceError,
  mapIssueInvoiceError,
  mapUpdateInvoiceStatusError,
} from "@/features/invoices/lib/invoice-errors";

describe("mapUpdateInvoiceStatusError (VI-F09-S08)", () => {
  it("should say the change is not allowed for IV004, on the status", () => {
    expect(mapUpdateInvoiceStatusError({ code: "IV004" })).toEqual({
      code: "CONFLICT",
      message: "This status change is not allowed for the invoice as it is now. Reload the page to see it.",
      field: "status",
    });
  });

  it("should ask for a reason for IV005, on the reason", () => {
    expect(mapUpdateInvoiceStatusError({ code: "IV005" })).toEqual({
      code: "VALIDATION_ERROR",
      message: "Enter a reason for voiding the invoice.",
      field: "reason",
    });
  });

  it.each([
    ["42501", "FORBIDDEN"],
    ["P0002", "NOT_FOUND"],
    ["22023", "VALIDATION_ERROR"],
  ])("should map %s to %s", (code, expected) => {
    expect(mapUpdateInvoiceStatusError({ code }).code).toBe(expected);
  });

  it("should never show a raw database error: anything else is the generic error", () => {
    expect(mapUpdateInvoiceStatusError({ code: "XX000" })).toEqual(STATUS_INTERNAL_ERROR);
  });
});

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

describe("mapIssueInvoiceError (VI-F09-S07)", () => {
  it("should say the invoice is no longer a draft for IV002", () => {
    expect(mapIssueInvoiceError({ code: "IV002" })).toEqual({
      code: "CONFLICT",
      message: "This invoice is no longer a draft. Reload the page to see it.",
    });
  });

  it.each([
    ["42501", "FORBIDDEN"],
    ["P0002", "NOT_FOUND"],
    ["22023", "VALIDATION_ERROR"],
  ])("should map %s to %s", (code, expected) => {
    expect(mapIssueInvoiceError({ code }).code).toBe(expected);
  });

  it("should never show a raw database error: anything else is the generic error", () => {
    expect(mapIssueInvoiceError({ code: "XX000" })).toEqual(ISSUE_INTERNAL_ERROR);
  });
});
