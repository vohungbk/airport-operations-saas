"use client";

import { Button } from "@/components/ui/button";
import { useDashboardRefresh } from "@/features/dashboard/lib/use-dashboard-refresh";

/** Counts the figures again; shown when some or all of them could not be read. */
export function DashboardRetryButton() {
  const { isRefreshing, refresh } = useDashboardRefresh();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={refresh}
      disabled={isRefreshing}
    >
      {isRefreshing ? "Retrying..." : "Try again"}
    </Button>
  );
}
