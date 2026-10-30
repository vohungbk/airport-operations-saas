"use client";

import { PageError } from "@/components/shared/page-error";

interface InvoiceErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function InvoiceError({ reset }: InvoiceErrorProps) {
  return <PageError title="Could not load the invoice" reset={reset} />;
}
