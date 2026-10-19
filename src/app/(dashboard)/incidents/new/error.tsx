"use client";

import { PageError } from "@/components/shared/page-error";

interface NewIncidentErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function NewIncidentError({ reset }: NewIncidentErrorProps) {
  return <PageError title="Could not load the report form" reset={reset} />;
}
