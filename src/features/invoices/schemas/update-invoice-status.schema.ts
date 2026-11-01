import { z } from "zod";

import { INVOICE_STATUSES } from "@/features/invoices/lib/invoice-list";
import { STATUS_REASON_MAX, reasonRequired } from "@/features/invoices/lib/invoice-status";

export const REASON_REQUIRED = "Enter a reason for voiding the invoice.";
export const REASON_TOO_LONG = `The reason must be at most ${STATUS_REASON_MAX} characters.`;

// z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs.
/**
 * VI-F09-S08: which invoice, which status, and why. A void needs a reason. Whether the move is allowed depends on the
 * status the invoice has now, which only the database function reads.
 */
export const updateInvoiceStatusSchema = z
  .object({
    invoice_id: z.guid("Choose an invoice."),
    status: z.enum(INVOICE_STATUSES, "Choose a status."),
    reason: z.string().trim().max(STATUS_REASON_MAX, REASON_TOO_LONG).optional(),
  })
  .superRefine((value, ctx) => {
    if (reasonRequired(value.status) && !value.reason) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: REASON_REQUIRED });
    }
  });

export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;
