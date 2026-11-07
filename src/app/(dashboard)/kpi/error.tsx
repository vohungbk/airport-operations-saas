"use client";

import { PageError } from "@/components/shared/page-error";

interface KpiErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function KpiError({ reset }: KpiErrorProps) {
  return <PageError title="Could not load the KPIs" reset={reset} />;
}
