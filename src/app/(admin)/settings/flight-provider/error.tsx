"use client";

import { PageError } from "@/components/shared/page-error";

interface FlightProviderErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function FlightProviderError({ reset }: FlightProviderErrorProps) {
  return <PageError title="Could not load the flight source" reset={reset} />;
}
