"use client";

import { PageError } from "@/components/shared/page-error";

interface IncidentDetailErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function IncidentDetailError({
  reset,
}: IncidentDetailErrorProps) {
  return <PageError title="Could not load incident" reset={reset} />;
}
