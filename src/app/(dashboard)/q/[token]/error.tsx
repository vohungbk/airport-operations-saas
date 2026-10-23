"use client";

import { PageError } from "@/components/shared/page-error";

interface SeatQrErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SeatQrError({ reset }: SeatQrErrorProps) {
  return <PageError title="Could not open this seat" reset={reset} />;
}
