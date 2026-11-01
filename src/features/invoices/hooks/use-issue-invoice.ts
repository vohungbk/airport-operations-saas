"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { runClientAction } from "@/lib/actions/run-client-action";
import { issueInvoiceAction } from "@/features/invoices/actions/issue-invoice.action";
import { ISSUE_NETWORK_ERROR } from "@/features/invoices/lib/invoice-errors";

/**
 * The Confirm issue action of an invoice (VI-F09-S07). A failure leaves the message to show and nothing else, and the
 * same action can be run again. On success the page is read again, so the status and the due date cannot go stale.
 */
export function useIssueInvoice(invoiceId: string, onIssued: () => void) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const issue = () => {
    setError(null);
    startTransition(async () => {
      const result = await runClientAction(() => issueInvoiceAction({ invoice_id: invoiceId }), ISSUE_NETWORK_ERROR);

      if (result.success) {
        onIssued();
        router.refresh();
      } else {
        setError(result.error.message);
      }
    });
  };

  return { issue, isPending, error, reset: () => setError(null) };
}
