"use client";

import { PageError } from "@/components/shared/page-error";

interface PartnersErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PartnersError({ reset }: PartnersErrorProps) {
  return <PageError title="Could not load partners" reset={reset} />;
}
