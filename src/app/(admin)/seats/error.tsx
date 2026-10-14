"use client";

import { PageError } from "@/components/shared/page-error";

interface SeatsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SeatsError({ reset }: SeatsErrorProps) {
  return <PageError title="Could not load seats" reset={reset} />;
}
