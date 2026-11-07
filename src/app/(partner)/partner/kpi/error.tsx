"use client";

import { PageError } from "@/components/shared/page-error";

interface PartnerKpiErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PartnerKpiError({ reset }: PartnerKpiErrorProps) {
  return <PageError title="Could not load the KPIs" reset={reset} />;
}
