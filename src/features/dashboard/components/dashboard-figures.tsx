import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageEmpty } from "@/components/shared/page-state";
import { DashboardMetricsGrid } from "@/features/dashboard/components/dashboard-metrics-grid";
import { DashboardRetryButton } from "@/features/dashboard/components/dashboard-retry-button";
import {
  getDashboardState,
  hasUnreleasedMetrics,
} from "@/features/dashboard/lib/dashboard-state";
import type { DashboardMetricResult } from "@/features/dashboard/lib/get-dashboard-metrics";

interface DashboardFiguresProps {
  results: readonly DashboardMetricResult[];
}

/**
 * The figures and what to say about the ones that are missing, shared by the
 * dashboard and the partner home so both show gaps the same way: Unavailable
 * with a retry, Not available yet, or no data yet. None of them is shown as 0.
 */
export function DashboardFigures({ results }: DashboardFiguresProps) {
  const state = getDashboardState(results);

  return (
    <>
      {(state === "partial" || state === "unavailable") && (
        <Alert variant="destructive">
          <AlertTitle>Some figures are unavailable</AlertTitle>
          <AlertDescription>
            {state === "unavailable"
              ? "None of the figures could be read right now."
              : "Some figures could not be read and are marked Unavailable. The others are up to date."}
          </AlertDescription>
          <div className="mt-2">
            <DashboardRetryButton />
          </div>
        </Alert>
      )}

      {hasUnreleasedMetrics(results) && (
        <Alert>
          <AlertTitle>Some figures are not available yet</AlertTitle>
          <AlertDescription>
            Some parts of the system are not released yet. Their figures are
            marked Not available yet and are not counted.
          </AlertDescription>
        </Alert>
      )}

      {state === "empty" ? (
        <PageEmpty message="No operational data yet. Figures appear here once there are seats, bookings, jobs or incidents." />
      ) : (
        <DashboardMetricsGrid results={results} />
      )}
    </>
  );
}
