"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Runs the server page again, so every figure is counted again. No cache and
 * no client copy of the figures is kept: a retry is a fresh request.
 */
export function useDashboardRefresh() {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  return { isRefreshing, refresh };
}
