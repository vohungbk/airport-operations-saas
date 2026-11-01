import { describe, expect, it } from "vitest";

import { paymentTermsText } from "@/features/invoices/lib/invoice-detail";
import { addDays, buildIssuePreview } from "@/features/invoices/lib/invoice-issue";

describe("addDays (VI-F09-S07, AC01)", () => {
  it("should add the payment terms to the issue date", () => {
    expect(addDays("2026-10-01", 30)).toBe("2026-10-31");
  });

  it("should carry into the next month and the next year", () => {
    expect(addDays("2026-01-25", 14)).toBe("2026-02-08");
    expect(addDays("2026-12-25", 14)).toBe("2027-01-08");
  });

  it("should count the days of a leap year", () => {
    expect(addDays("2028-02-20", 14)).toBe("2028-03-05");
  });

  it("should give the same day for no payment terms", () => {
    expect(addDays("2026-10-01", 0)).toBe("2026-10-01");
  });
});

describe("paymentTermsText", () => {
  it("should say 1 day, not 1 days", () => {
    expect([paymentTermsText(1), paymentTermsText(14), paymentTermsText(0)]).toEqual(["1 day", "14 days", "0 days"]);
  });
});

describe("buildIssuePreview (VI-F09-S07, the Issue confirmation)", () => {
  const input = {
    invoice_number: "INV-2026-000044",
    partner_name: "Emirates Rent A Car",
    payment_terms_days: 30,
    today: "2026-10-01",
  };

  it("should write the partner, the issue date, the payment terms and the due date, as the design does", () => {
    expect(buildIssuePreview(input)).toEqual({
      heading: "INV-2026-000044 / Emirates Rent A Car",
      issue_date: "01 Oct 2026",
      payment_terms: "30 days",
      due_date: "31 Oct 2026",
    });
  });

  it("should give the due date of the payment terms asked for (AC02)", () => {
    expect(buildIssuePreview({ ...input, payment_terms_days: 14 })).toMatchObject({
      payment_terms: "14 days",
      due_date: "15 Oct 2026",
    });
  });

  it("should write the number alone for an invoice with no partner", () => {
    expect(buildIssuePreview({ ...input, partner_name: null }).heading).toBe("INV-2026-000044");
  });
});
