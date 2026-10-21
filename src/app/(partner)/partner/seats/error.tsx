"use client";

import { PageError } from "@/components/shared/page-error";

interface PartnerSeatsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PartnerSeatsError({ reset }: PartnerSeatsErrorProps) {
  return <PageError title="Could not load seats" reset={reset} />;
}
