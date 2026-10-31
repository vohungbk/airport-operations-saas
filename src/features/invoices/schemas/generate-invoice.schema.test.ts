import { describe, expect, it } from "vitest";

import { PERIOD_REQUIRED, generateInvoiceSchema } from "@/features/invoices/schemas/generate-invoice.schema";

const PARTNER = "b0000000-0000-0000-0000-000000000001";
const input = (change: Record<string, unknown> = {}) => ({ partner_id: PARTNER, month: "2026-09", ...change });
const firstIssue = (value: unknown) => {
  const result = generateInvoiceSchema.safeParse(value);

  return result.success ? null : { field: result.error.issues[0].path[0], message: result.error.issues[0].message };
};

describe("generateInvoiceSchema (VI-F09-S06, AC01, AC03)", () => {
  it("should accept a partner and a month", () => {
    expect(generateInvoiceSchema.safeParse(input()).success).toBe(true);
  });

  it.each([
    ["a missing month", { month: undefined }],
    ["an empty month", { month: "" }],
    ["a month that is not a month", { month: "2026-13" }],
    ["a date instead of a month", { month: "2026-09-01" }],
  ])("should ask for a period with an approved settlement for %s", (_name, change) => {
    expect(firstIssue(input(change))).toEqual({ field: "month", message: PERIOD_REQUIRED });
  });

  it.each([
    ["a missing partner", { partner_id: undefined }],
    ["a partner that is not an id", { partner_id: "abc" }],
  ])("should ask for a partner for %s", (_name, change) => {
    expect(firstIssue(input(change))).toEqual({ field: "partner_id", message: "Choose a partner." });
  });
});
