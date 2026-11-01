import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/features/invoices/lib/invoice-list";

/** The longest reason finance_history keeps. */
export const STATUS_REASON_MAX = 1000;

/**
 * VI-F09-S08 (spec F1, V1): the moves of the payment status an admin can make by hand. The database function
 * `update_invoice_status()` holds the same table and is the one that decides; this copy lets the screen offer only
 * the moves that can succeed. A draft is only issued with Issue invoice (VI-F09-S07). Paid and void do not go on.
 */
export const INVOICE_STATUS_MOVES: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: [],
  issued: ["paid", "overdue", "void"],
  overdue: ["paid", "void"],
  paid: [],
  void: [],
};

export const allowedMoves = (from: InvoiceStatus): readonly InvoiceStatus[] => INVOICE_STATUS_MOVES[from];

export const canMove = (from: InvoiceStatus, to: InvoiceStatus): boolean => INVOICE_STATUS_MOVES[from].includes(to);

/** A void needs a reason; for the other moves it is optional. */
export const reasonRequired = (to: InvoiceStatus): boolean => to === "void";

/** The message for a move that is not allowed (V1), or `null` when it is allowed. */
export function moveError(from: InvoiceStatus, to: InvoiceStatus): string | null {
  return canMove(from, to)
    ? null
    : `An invoice that is ${INVOICE_STATUS_LABEL[from].toLowerCase()} cannot be changed to ${INVOICE_STATUS_LABEL[to].toLowerCase()}.`;
}
