"use client";

import { PageError } from "@/components/shared/page-error";

interface ImportHistoryErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ImportHistoryError({ reset }: ImportHistoryErrorProps) {
  return <PageError title="Could not load the import history" reset={reset} />;
}
