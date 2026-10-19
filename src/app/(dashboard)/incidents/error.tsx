"use client";

import { PageError } from "@/components/shared/page-error";

interface IncidentsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function IncidentsError({ reset }: IncidentsErrorProps) {
  return <PageError title="Could not load incidents" reset={reset} />;
}
