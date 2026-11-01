import { describe, expect, it } from "vitest";

import {
  REASON_REQUIRED,
  REASON_TOO_LONG,
  updateInvoiceStatusSchema,
} from "@/features/invoices/schemas/update-invoice-status.schema";

const ID = "d9100000-0000-0000-0000-000000000001";
const message = (input: unknown) => {
  const result = updateInvoiceStatusSchema.safeParse(input);

  return result.success ? null : result.error.issues[0]?.message;
};

describe("updateInvoiceStatusSchema (VI-F09-S08, V1)", () => {
  it("should accept a status with no reason when it is not a void (AC02)", () => {
    expect(updateInvoiceStatusSchema.safeParse({ invoice_id: ID, status: "paid" }).success).toBe(true);
  });

  it("should keep a trimmed reason", () => {
    expect(updateInvoiceStatusSchema.parse({ invoice_id: ID, status: "overdue", reason: "  late  " }).reason).toBe("late");
  });

  it("should accept a void with a reason (AC05)", () => {
    expect(updateInvoiceStatusSchema.safeParse({ invoice_id: ID, status: "void", reason: "Issued to the wrong partner" }).success).toBe(
      true,
    );
  });

  it.each([
    ["no reason", {}],
    ["a reason of spaces", { reason: "   " }],
  ])("should refuse a void with %s (AC05)", (_name, extra) => {
    expect(message({ invoice_id: ID, status: "void", ...extra })).toBe(REASON_REQUIRED);
  });

  it("should refuse a reason longer than 1000 characters, and accept one of exactly 1000", () => {
    expect(message({ invoice_id: ID, status: "paid", reason: "a".repeat(1001) })).toBe(REASON_TOO_LONG);
    expect(updateInvoiceStatusSchema.safeParse({ invoice_id: ID, status: "paid", reason: "a".repeat(1000) }).success).toBe(true);
  });

  it.each([
    ["a missing id", { status: "paid" }, "Choose an invoice."],
    ["an id that is not an id", { invoice_id: "abc", status: "paid" }, "Choose an invoice."],
    ["a missing status", { invoice_id: ID }, "Choose a status."],
    ["a status outside the list", { invoice_id: ID, status: "refunded" }, "Choose a status."],
  ])("should refuse %s (AC04)", (_name, input, expected) => {
    expect(message(input)).toBe(expected);
  });
});
