"use client";

import { PageError } from "@/components/shared/page-error";

interface BookingWorkflowErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BookingWorkflowError({ reset }: BookingWorkflowErrorProps) {
  return <PageError title="The booking workflow could not be loaded." reset={reset} />;
}
