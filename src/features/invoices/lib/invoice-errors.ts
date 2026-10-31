import type { PostgrestError } from "@supabase/supabase-js";

import { PERIOD_REQUIRED } from "@/features/invoices/schemas/generate-invoice.schema";

/**
 * The stable error of the generate Server Action, as in `backend.md`: a code to branch on and a message. A raw
 * database error never reaches the client.
 */
export interface InvoiceActionError {
  code:
    | "VALIDATION_ERROR"
    | "SETTLEMENT_NOT_APPROVED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "NETWORK_ERROR"
    | "INTERNAL_ERROR";
  message: string;
  /** The field the message belongs to, when there is one. */
  field?: "partner_id" | "month";
  /** The invoice that already exists for the settlement (CONFLICT), so the screen can show it. */
  existing_invoice_id?: string;
}

export interface GeneratedInvoice {
  id: string;
  invoice_number: string;
  total: number;
}

export type GenerateInvoiceResult =
  | { success: true; invoice: GeneratedInvoice }
  | { success: false; error: InvoiceActionError };

export const VALIDATION_ERROR: InvoiceActionError = {
  code: "VALIDATION_ERROR",
  message: "Check the form and try again.",
};

export const FORBIDDEN_ERROR: InvoiceActionError = {
  code: "FORBIDDEN",
  message: "You cannot generate an invoice.",
};

export const NETWORK_ERROR: InvoiceActionError = {
  code: "NETWORK_ERROR",
  message: "Could not reach the server. Your entries are kept: try again.",
};

export const INTERNAL_ERROR: InvoiceActionError = {
  code: "INTERNAL_ERROR",
  message: "The invoice could not be generated. Try again.",
};

/** The error codes of `generate_invoice()`. Anything else is a generic error. */
export function mapInvoiceError(error: Pick<PostgrestError, "code"> & { details?: string | null }): InvoiceActionError {
  switch (error.code) {
    case "42501":
      return FORBIDDEN_ERROR;
    case "P0002":
      return { code: "NOT_FOUND", message: "Partner not found.", field: "partner_id" };
    case "IN002":
      return { code: "SETTLEMENT_NOT_APPROVED", message: PERIOD_REQUIRED, field: "month" };
    case "IN003":
      return {
        code: "CONFLICT",
        message: "An invoice for this period already exists.",
        field: "month",
        ...(error.details ? { existing_invoice_id: error.details } : {}),
      };
    case "22023":
      return VALIDATION_ERROR;
    default:
      return INTERNAL_ERROR;
  }
}
