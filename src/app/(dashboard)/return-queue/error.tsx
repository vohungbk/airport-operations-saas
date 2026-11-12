"use client";

import { PageError } from "@/components/shared/page-error";

interface ReturnQueueErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ReturnQueueError({ reset }: ReturnQueueErrorProps) {
  return <PageError title="Could not load the return queue" reset={reset} />;
}
