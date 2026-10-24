"use client";

import { PageError } from "@/components/shared/page-error";

interface BookingRevenueErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BookingRevenueError({ reset }: BookingRevenueErrorProps) {
  return <PageError title="Could not load the booking revenue" reset={reset} />;
}
