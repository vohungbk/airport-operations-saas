import type { DashboardMetricResult } from "@/features/dashboard/lib/get-dashboard-metrics";
import type { Role } from "@/lib/auth/roles";

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
 * never counted as zero. A metric of a module that is not released is left
 * out of the count: it is neither zero nor a failed read.
 */
export function getDashboardState(
  results: readonly DashboardMetricResult[],
): DashboardState {
  const applicable = results.filter((result) => result.reason !== "not_released");
  const read = applicable.filter((result) => result.value !== null);

  if (applicable.length === 0) {
    // Only figures that are not available yet: nothing was read, nothing failed.
    return results.length > 0 ? "ready" : "empty";
  }

  if (read.length === 0) {
    return "unavailable";
  }

  if (read.length < applicable.length) {
    return "partial";
  }

  return read.every((result) => result.value === 0) ? "empty" : "ready";
}

/** True when some figure belongs to a module that is not released. */
export function hasUnreleasedMetrics(
  results: readonly DashboardMetricResult[],
): boolean {
  return results.some((result) => result.reason === "not_released");
}

/**
 * A partner user who is not linked to a partner gets no rows from RLS, so
 * every figure would be 0. That is a gap in the account, not an empty
 * business: the page says so instead of showing zeros.
 */
export function isUnlinkedPartner(user: {
  role: Role;
  partner_id: string | null;
}): boolean {
  return user.role === "partner_user" && user.partner_id === null;
}
