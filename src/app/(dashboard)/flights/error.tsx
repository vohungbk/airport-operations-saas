"use client";

import { PageError } from "@/components/shared/page-error";

interface FlightsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function FlightsError({ reset }: FlightsErrorProps) {
  return <PageError title="Could not load the flight board" reset={reset} />;
}
