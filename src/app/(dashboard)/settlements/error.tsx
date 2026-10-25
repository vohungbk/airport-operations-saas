"use client";

import { PageError } from "@/components/shared/page-error";

interface SettlementsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SettlementsError({ reset }: SettlementsErrorProps) {
  return <PageError title="Could not load the settlements" reset={reset} />;
}
