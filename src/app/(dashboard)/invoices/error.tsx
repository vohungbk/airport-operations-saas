"use client";

import { PageError } from "@/components/shared/page-error";

interface InvoicesErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function InvoicesError({ reset }: InvoicesErrorProps) {
  return <PageError title="Could not load invoices" reset={reset} />;
}
