"use client";

import { PageError } from "@/components/shared/page-error";

interface TechniciansErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TechniciansError({ reset }: TechniciansErrorProps) {
  return <PageError title="Could not load technicians" reset={reset} />;
}
