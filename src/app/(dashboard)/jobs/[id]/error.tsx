"use client";

import { PageError } from "@/components/shared/page-error";

interface JobDetailErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function JobDetailError({ reset }: JobDetailErrorProps) {
  return <PageError title="Could not load job" reset={reset} />;
}
