"use client";

import { PageError } from "@/components/shared/page-error";

interface CommercialTermsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CommercialTermsError({ reset }: CommercialTermsErrorProps) {
  return <PageError title="Could not load the commercial terms" reset={reset} />;
}
