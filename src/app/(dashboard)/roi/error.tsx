"use client";

import { PageError } from "@/components/shared/page-error";

interface RoiErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RoiError({ reset }: RoiErrorProps) {
  return <PageError title="Could not load the ROI dashboard" reset={reset} />;
}
