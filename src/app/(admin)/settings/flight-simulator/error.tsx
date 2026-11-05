"use client";

import { PageError } from "@/components/shared/page-error";

interface FlightSimulatorErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function FlightSimulatorError({ reset }: FlightSimulatorErrorProps) {
  return <PageError title="Could not load the flight simulator" reset={reset} />;
}
