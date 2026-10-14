"use client";

import { PageError } from "@/components/shared/page-error";

interface JobsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function JobsError({ reset }: JobsErrorProps) {
  return <PageError title="Could not load jobs" reset={reset} />;
}
