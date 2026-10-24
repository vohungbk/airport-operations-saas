"use client";

import { PageError } from "@/components/shared/page-error";

interface AdjustmentErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdjustmentError({ reset }: AdjustmentErrorProps) {
  return <PageError title="Could not open the adjustment form" reset={reset} />;
}
