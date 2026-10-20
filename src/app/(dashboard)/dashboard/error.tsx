"use client";

import { PageError } from "@/components/shared/page-error";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ reset }: DashboardErrorProps) {
  return <PageError title="Could not load the dashboard" reset={reset} />;
}
