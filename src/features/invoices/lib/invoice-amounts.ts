import { toCents } from "@/lib/money/money";

/** The VAT of an invoice, in percent (the design; the same rate as `generate_invoice()`). */
export const INVOICE_VAT_PERCENT = 5;

export interface InvoiceAmounts {
  subtotal: number;
  vat: number;
  total: number;
}

/**
 * Pure (VI-F09-S06). What the invoice made from a settlement is worth: the platform share plus the fees, the VAT on
 * that, and the total. It is the same sum as `generate_invoice()` and the screen shows it before the draft is made.
 * Whole cents, so 0.1 + 0.2 is 0.30; the VAT is rounded to the cent, half away from zero, as the database does.
 */
export function invoiceAmounts(platformShare: number, fees: number): InvoiceAmounts {
  const subtotal = toCents(platformShare) + toCents(fees);
  const vat = Math.round((subtotal * INVOICE_VAT_PERCENT) / 100);

  return { subtotal: subtotal / 100, vat: vat / 100, total: (subtotal + vat) / 100 };
}
