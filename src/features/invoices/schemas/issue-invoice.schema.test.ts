import { describe, expect, it } from "vitest";

import { issueInvoiceSchema } from "@/features/invoices/schemas/issue-invoice.schema";

describe("issueInvoiceSchema (VI-F09-S07)", () => {
  it("should accept the id of an invoice", () => {
    expect(issueInvoiceSchema.safeParse({ invoice_id: "d9100000-0000-0000-0000-000000000001" }).success).toBe(true);
  });

  it.each([
    ["a missing id", {}],
    ["an empty id", { invoice_id: "" }],
    ["an id that is not an id", { invoice_id: "1; drop table invoices" }],
  ])("should refuse %s with a message", (_name, input) => {
    const result = issueInvoiceSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0].message).toBe("Choose an invoice.");
  });
});
