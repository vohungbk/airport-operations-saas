"use client";

import { PageError } from "@/components/shared/page-error";

interface PartnerBaselineInputsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PartnerBaselineInputsError({ reset }: PartnerBaselineInputsErrorProps) {
  return <PageError title="Could not load the baseline inputs" reset={reset} />;
}
