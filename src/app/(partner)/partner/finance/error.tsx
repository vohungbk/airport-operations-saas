"use client";

import { PageError } from "@/components/shared/page-error";

interface PartnerFinanceErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PartnerFinanceError({ reset }: PartnerFinanceErrorProps) {
  return <PageError title="Could not load finance" reset={reset} />;
}
