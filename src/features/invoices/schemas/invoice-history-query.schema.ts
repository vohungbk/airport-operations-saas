import { z } from "zod";

/** The oldest and newest year the Period field can name; anything else in the address is ignored. */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/**
 * What the Invoice history screen reads from the address (VI-F09-S10): one invoice and one year. A garbled value falls
 * back to "not given" instead of failing the render. Neither one widens what the caller may see: the database decides
 * the scope, and an invoice the caller may not see gives an empty history.
 */
export const invoiceHistoryQuerySchema = z.object({
  invoice_id: z.guid().optional().catch(undefined),
  year: z.coerce.number().int().min(MIN_YEAR).max(MAX_YEAR).optional().catch(undefined),
});

export type InvoiceHistoryQuery = z.infer<typeof invoiceHistoryQuerySchema>;
