import { z } from "zod";

// z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs.
/** VI-F09-S07: which invoice to issue. Whether it is a draft is checked by the database function. */
export const issueInvoiceSchema = z.object({
  invoice_id: z.guid("Choose an invoice."),
});

export type IssueInvoiceInput = z.infer<typeof issueInvoiceSchema>;
