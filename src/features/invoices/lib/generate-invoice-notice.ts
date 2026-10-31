import type { InvoiceActionError } from "@/features/invoices/lib/invoice-errors";
import type { PeriodOption } from "@/features/invoices/lib/invoice-periods";

/** The box under the amount in the Generate invoice design: one of its states at a time. */
export type InvoiceNotice =
  | { kind: "info"; title: string; message: string }
  | { kind: "validation"; title: string; message: string }
  | { kind: "not_approved"; title: string; message: string; note: string | null }
  | { kind: "duplicate"; title: string; message: string; invoice_id: string | null }
  | { kind: "server_error"; title: string; message: string }
  | { kind: "error"; title: string; message: string };

interface NoticeInput {
  /** The message of the client validation that stopped the submit, if it did. */
  validation: string | null;
  /** The error the Server Action answered, if it did. */
  error: InvoiceActionError | null;
  selected: PeriodOption | null;
}

/**
 * Pure (VI-F09-S06). What the box says, from what happened: a client validation, the answer of the server, or a month
 * whose invoice already exists. With none of them, it tells that this only makes a draft.
 */
export function buildInvoiceNotice({ validation, error, selected }: NoticeInput): InvoiceNotice {
  if (validation) {
    return { kind: "validation", title: "Validation error", message: validation };
  }

  if (error?.code === "SETTLEMENT_NOT_APPROVED") {
    return {
      kind: "not_approved",
      title: "Settlement not approved",
      message: error.message,
      note: selected ? `${selected.label} is disabled: No approved settlement.` : null,
    };
  }

  if (error?.code === "CONFLICT" || (!error && selected?.invoice_id)) {
    return {
      kind: "duplicate",
      title: "Duplicate invoice",
      message: "An invoice for this period already exists",
      invoice_id: error?.existing_invoice_id ?? selected?.invoice_id ?? null,
    };
  }

  if (error?.code === "INTERNAL_ERROR" || error?.code === "NETWORK_ERROR") {
    return { kind: "server_error", title: "Server error", message: error.message };
  }

  if (error) {
    return { kind: "error", title: "Could not generate the invoice", message: error.message };
  }

  return {
    kind: "info",
    title: "Generate a draft first",
    message: "No invoice is issued until you confirm the issue step.",
  };
}
