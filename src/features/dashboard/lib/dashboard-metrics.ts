import {
  BOOKINGS_ACCESS_PERMISSIONS,
  INCIDENTS_ACCESS_PERMISSIONS,
  JOBS_ACCESS_PERMISSIONS,
  hasAnyPermission,
  type Permission,
} from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";

export type DashboardModule = "inventory" | "bookings" | "jobs" | "incidents";

export const DASHBOARD_MODULE_LABEL: Record<DashboardModule, string> = {
  inventory: "Inventory",
  bookings: "Bookings",
  jobs: "Jobs",
  incidents: "Incidents",
};

/**
 * Whether the module behind a figure is released. A figure of a module that is
 * not released is shown as not available yet: it is never counted, and never
 * shown as 0 (spec E1). All four modules are released today; flip a flag to
 * false while a module is still being built.
 */
export const DASHBOARD_MODULE_RELEASED: Readonly<Record<DashboardModule, boolean>> =
  {
    inventory: true,
    bookings: true,
    jobs: true,
    incidents: true,
  };

/** The tables the dashboard counts; each is also the table of a list screen. */
export type DashboardSource =
  | "seats"
  | "bookings"
  | "technician_jobs"
  | "incidents";

export interface DashboardMetric {
  id: string;
  module: DashboardModule;
  label: string;
  /** The formula, in words: what is counted. */
  formula: string;
  source: DashboardSource;
  /**
   * Column equals value. The same pairs are the query string of the list the
   * metric drills into, so the count and the list use one rule (spec E3).
   */
  filters: Readonly<Record<string, string>>;
  /** The list the metric drills into. */
  listPath: string;
  /** Who may open that list; the metric is shown to the same roles. */
  permissions: readonly Permission[];
}

/**
 * Every metric is "the rows of a table that match a filter, as the viewer's
 * RLS scope returns them". Nothing is stored or hardcoded: a value comes from
 * a count query at the time the page loads.
 */
export const DASHBOARD_METRICS: readonly DashboardMetric[] = [
  {
    id: "seats_available",
    module: "inventory",
    label: "Available seats",
    formula: "Seats whose status is available",
    source: "seats",
    filters: { status: "available" },
    listPath: "/seats",
    permissions: ["seats:manage"],
  },
  {
    id: "seats_quarantine",
    module: "inventory",
    label: "Quarantined seats",
    formula: "Seats whose status is quarantine",
    source: "seats",
    filters: { status: "quarantine" },
    listPath: "/seats",
    permissions: ["seats:manage"],
  },
  {
    id: "bookings_pending",
    module: "bookings",
    label: "Pending bookings",
    formula: "Bookings whose status is pending",
    source: "bookings",
    filters: { status: "pending" },
    listPath: "/bookings",
    permissions: BOOKINGS_ACCESS_PERMISSIONS,
  },
  {
    id: "bookings_in_progress",
    module: "bookings",
    label: "Bookings in progress",
    formula: "Bookings whose status is in progress",
    source: "bookings",
    filters: { status: "in_progress" },
    listPath: "/bookings",
    permissions: BOOKINGS_ACCESS_PERMISSIONS,
  },
  {
    id: "jobs_assigned",
    module: "jobs",
    label: "Assigned jobs",
    formula: "Jobs whose status is assigned",
    source: "technician_jobs",
    filters: { status: "assigned" },
    listPath: "/jobs",
    permissions: JOBS_ACCESS_PERMISSIONS,
  },
  {
    id: "jobs_in_progress",
    module: "jobs",
    label: "Jobs in progress",
    formula: "Jobs whose status is in progress",
    source: "technician_jobs",
    filters: { status: "in_progress" },
    listPath: "/jobs",
    permissions: JOBS_ACCESS_PERMISSIONS,
  },
  {
    id: "incidents_open",
    module: "incidents",
    label: "Open incidents",
    formula: "Incidents whose status is open",
    source: "incidents",
    filters: { status: "open" },
    listPath: "/incidents",
    permissions: INCIDENTS_ACCESS_PERMISSIONS,
  },
  {
    id: "incidents_critical_open",
    module: "incidents",
    label: "Critical open incidents",
    formula: "Incidents whose status is open and whose severity is critical",
    source: "incidents",
    filters: { status: "open", severity: "critical" },
    listPath: "/incidents",
    permissions: INCIDENTS_ACCESS_PERMISSIONS,
  },
];

/** The metrics a role may see: those of the lists it can open. */
export function getMetricsForRole(role: Role): DashboardMetric[] {
  return DASHBOARD_METRICS.filter((metric) =>
    hasAnyPermission(role, metric.permissions),
  );
}

/** The list the metric drills into, filtered by the rule the count uses. */
export function getMetricHref(metric: DashboardMetric): string {
  const params = new URLSearchParams(metric.filters);

  return `${metric.listPath}?${params.toString()}`;
}
