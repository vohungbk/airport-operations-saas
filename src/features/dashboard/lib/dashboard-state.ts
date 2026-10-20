import type { DashboardMetricResult } from "@/features/dashboard/lib/get-dashboard-metrics";

export type DashboardState =
  /** Every metric was read and at least one is above zero. */
  | "ready"
  /** Every metric was read and all are zero: nothing to show yet. */
  | "empty"
  /** Some metrics could not be read: the rest are shown with a note. */
  | "partial"
  /** No metric could be read. */
  | "unavailable";

/**
 * Pure. A zero is a real value, so an empty dashboard is only claimed when
 * every metric was read and is zero; a metric that could not be read is
 * never counted as zero.
 */
export function getDashboardState(
  results: readonly DashboardMetricResult[],
): DashboardState {
  const read = results.filter((result) => result.value !== null);

  if (results.length > 0 && read.length === 0) {
    return "unavailable";
  }

  if (read.length < results.length) {
    return "partial";
  }

  return read.every((result) => result.value === 0) ? "empty" : "ready";
}
