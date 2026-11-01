"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { runClientAction } from "@/lib/actions/run-client-action";
import { updateInvoiceStatusAction } from "@/features/invoices/actions/update-invoice-status.action";
import { NETWORK_ERROR, VALIDATION_ERROR } from "@/features/invoices/lib/invoice-errors";
import type { InvoiceStatus } from "@/features/invoices/lib/invoice-list";
import { allowedMoves, moveError, reasonRequired } from "@/features/invoices/lib/invoice-status";
import { updateInvoiceStatusSchema } from "@/features/invoices/schemas/update-invoice-status.schema";

/**
 * The Update payment status action of an invoice (VI-F09-S08). The same Zod schema and the same table of moves as the
 * server check the choice before it is sent (V1). A failure leaves the message to show and keeps the entries, so the
 * action can be run again. On success the page is read again, so the status cannot go stale.
 */
export function useUpdateInvoiceStatus(invoiceId: string, current: InvoiceStatus, onUpdated: () => void) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<InvoiceStatus | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const options = allowedMoves(current);

  const reset = () => {
    setStatus(null);
    setReason("");
    setError(null);
  };

  const update = () => {
    if (status === null) {
      setError("Choose a status.");
      return;
    }

    const notAllowed = moveError(current, status);
    const parsed = updateInvoiceStatusSchema.safeParse({ invoice_id: invoiceId, status, reason });

    if (notAllowed) {
      setError(notAllowed);
      return;
    }

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? VALIDATION_ERROR.message);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await runClientAction(() => updateInvoiceStatusAction(parsed.data), NETWORK_ERROR);

      if (result.success) {
        onUpdated();
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  };

  return {
    options,
    status,
    reason,
    error,
    isPending,
    needsReason: status !== null && reasonRequired(status),
    selectStatus: (next: InvoiceStatus) => {
      setStatus(next);
      setError(null);
    },
    changeReason: (next: string) => {
      setReason(next);
      setError(null);
    },
    update,
    reset,
  };
}
