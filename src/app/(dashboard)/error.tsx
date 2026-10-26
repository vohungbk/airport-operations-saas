"use client";

import { PageError } from "@/components/shared/page-error";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * The error boundary of every page of `(dashboard)` that has none of its own. It sits inside the layout
 * of the group, so the shell stays in place and only the content area shows the error
 * (UI-F02-S05, spec E5). A page with its own `error.tsx` keeps it.
 */
export default function DashboardError({ reset }: DashboardErrorProps) {
  return <PageError title="Could not load this page" reset={reset} />;
}
