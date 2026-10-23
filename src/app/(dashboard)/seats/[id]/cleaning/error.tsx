"use client";

import { PageError } from "@/components/shared/page-error";

interface SeatCleaningErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SeatCleaningError({ reset }: SeatCleaningErrorProps) {
  return <PageError title="Could not load the cleaning for this seat" reset={reset} />;
}
