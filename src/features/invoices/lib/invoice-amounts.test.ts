import { describe, expect, it } from "vitest";

import { invoiceAmounts } from "@/features/invoices/lib/invoice-amounts";

describe("invoiceAmounts (VI-F09-S06)", () => {
  it("should add the VAT of 5 percent to the platform share: 5,050.00 gives 252.50 and 5,302.50", () => {
    expect(invoiceAmounts(5050, 0)).toEqual({ subtotal: 5050, vat: 252.5, total: 5302.5 });
  });

  it("should add the fees to the subtotal before the VAT", () => {
    expect(invoiceAmounts(315, 20)).toEqual({ subtotal: 335, vat: 16.75, total: 351.75 });
  });

  it("should round the VAT to the cent, half up, like the database", () => {
    // 0.10 * 5 % = 0.005 -> 0.01; 0.30 * 5 % = 0.015 -> 0.02.
    expect(invoiceAmounts(0.1, 0).vat).toBe(0.01);
    expect(invoiceAmounts(0.3, 0).vat).toBe(0.02);
  });

  it("should add in whole cents, so 0.1 + 0.2 is 0.30", () => {
    expect(invoiceAmounts(0.1, 0.2).subtotal).toBe(0.3);
  });

  it("should give zero for a settlement with nothing to bill", () => {
    expect(invoiceAmounts(0, 0)).toEqual({ subtotal: 0, vat: 0, total: 0 });
  });
});
