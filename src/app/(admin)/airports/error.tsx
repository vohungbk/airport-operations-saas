"use client";

import { PageError } from "@/components/shared/page-error";

interface AirportsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AirportsError({ reset }: AirportsErrorProps) {
  return <PageError title="Could not load airports" reset={reset} />;
}
