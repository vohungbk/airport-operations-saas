/** The number of the invoice with anything that is not a letter, a digit, a dot or a dash made safe in a file name. */
export const safeInvoiceFileStem = (invoiceNumber: string) => invoiceNumber.replace(/[^A-Za-z0-9._-]/g, "_");

/**
 * `INV-2026-000045.pdf`: the number of the invoice, made safe. Apart from the PDF builder so that the screen can
 * name the file without the PDF library.
 */
export function invoicePdfFileName(invoiceNumber: string): string {
  return `${safeInvoiceFileStem(invoiceNumber)}.pdf`;
}
