"use client";

import { PageError } from "@/components/shared/page-error";

interface BookingsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BookingsError({ reset }: BookingsErrorProps) {
  return <PageError title="Could not load bookings" reset={reset} />;
}
