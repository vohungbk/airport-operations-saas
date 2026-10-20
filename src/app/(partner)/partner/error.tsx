"use client";

import { PageError } from "@/components/shared/page-error";

interface PartnerErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PartnerError({ reset }: PartnerErrorProps) {
  return <PageError title="Could not load the partner home" reset={reset} />;
}
