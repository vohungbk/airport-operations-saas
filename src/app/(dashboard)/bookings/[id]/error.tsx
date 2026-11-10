"use client";

import { PageError } from "@/components/shared/page-error";

interface BookingDetailErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BookingDetailError({ reset }: BookingDetailErrorProps) {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="px-4 pt-4 text-3xl font-semibold tracking-tight text-foreground sm:px-8 sm:pt-8">
        Booking detail
      </h1>
      <PageError
        title="Unable to load overview"
        description="Booking data could not be loaded. Retry to refresh this tab."
        reset={reset}
        resetLabel="Retry"
      />
    </div>
  );
}
