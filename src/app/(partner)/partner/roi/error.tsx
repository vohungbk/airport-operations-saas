"use client";

import { PageError } from "@/components/shared/page-error";

interface PartnerRoiErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PartnerRoiError({ reset }: PartnerRoiErrorProps) {
  return <PageError title="Could not load the ROI dashboard" reset={reset} />;
}
