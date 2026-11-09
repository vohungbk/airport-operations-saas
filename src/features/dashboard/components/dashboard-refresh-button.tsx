"use client";

import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDashboardRefresh } from "@/features/dashboard/lib/use-dashboard-refresh";

/** Counts every figure of the Command Centre again, on demand; the load time under the title moves with it. */
export function DashboardRefreshButton() {
  const { isRefreshing, refresh } = useDashboardRefresh();

  return (
    <Button variant="outline" onClick={refresh} disabled={isRefreshing}>
      <RefreshCwIcon aria-hidden="true" className={isRefreshing ? "animate-spin" : undefined} />
      {isRefreshing ? "Refreshing..." : "Refresh"}
    </Button>
  );
}
