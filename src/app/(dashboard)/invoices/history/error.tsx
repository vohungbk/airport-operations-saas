"use client";

import { PageError } from "@/components/shared/page-error";

interface InvoiceHistoryErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function InvoiceHistoryError({ reset }: InvoiceHistoryErrorProps) {
  return <PageError title="Could not load invoice history" reset={reset} />;
}
