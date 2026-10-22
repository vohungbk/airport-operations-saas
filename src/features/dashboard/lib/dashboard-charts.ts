import { BOOKING_STATUSES, BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_SEVERITY_LABEL,
  type IncidentSeverity,
} from "@/features/incidents/lib/incident-severity";
import { JOB_STATUSES, JOB_STATUS_LABEL } from "@/features/jobs/lib/job-status";
import { SEAT_STATUSES, SEAT_STATUS_LABEL } from "@/features/seats/lib/seat-status";
import type { DashboardModule, DashboardSource } from "@/features/dashboard/lib/dashboard-metrics";
import {
  BOOKINGS_ACCESS_PERMISSIONS,
  INCIDENTS_ACCESS_PERMISSIONS,
  JOBS_ACCESS_PERMISSIONS,
  hasAnyPermission,
  type Permission,
} from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";

/** How a bar is drawn. The word beside it says the same thing, so colour is never the only cue. */
export type ChartTone = "success" | "warning" | "info" | "destructive" | "muted";

export interface ChartCategory {
  key: string;
  label: string;
  /** Column equals value: the rows of the table that this bar counts, like the filters of a metric. */
  filters: Readonly<Record<string, string>>;
  tone: ChartTone;
  /** The bar that has to stand out: it gets an icon and a heavier label as well as its colour. */
  emphasis?: boolean;
}

export interface DashboardChartDef {
  id: string;
  module: DashboardModule;
  title: string;
  source: DashboardSource;
  categories: readonly ChartCategory[];
  /** Who may see the chart: the same roles that see the metrics of the module. */
  permissions: readonly Permission[];
  /** Said when there is nothing to chart, instead of a chart of zeros. */
  emptyMessage: string;
}

const SEAT_TONE = {
  available: "success",
  reserved: "info",
  in_use: "info",
  cleaning: "warning",
  inspection: "warning",
  quarantine: "destructive",
  retired: "muted",
} as const satisfies Record<(typeof SEAT_STATUSES)[number], ChartTone>;

const BOOKING_TONE = {
  pending: "warning",
  confirmed: "info",
  assigned: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "muted",
  no_show: "destructive",
} as const satisfies Record<(typeof BOOKING_STATUSES)[number], ChartTone>;

const JOB_TONE = {
  assigned: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "muted",
} as const satisfies Record<(typeof JOB_STATUSES)[number], ChartTone>;

const SEVERITY_TONE = {
  low: "muted",
  medium: "info",
  high: "warning",
  critical: "destructive",
} as const satisfies Record<IncidentSeverity, ChartTone>;

/** Critical first: the bar to look at is at the top. */
const SEVERITIES_BY_WEIGHT: readonly IncidentSeverity[] = [...INCIDENT_SEVERITIES].reverse();

/**
 * One chart for each group of figures (spec VI-F01 R7). Each bar is the number of
 * rows of one table that match a filter, counted with the same function as the
 * count cards and in the scope of the viewer's RLS, so a bar that has a card has the
 * same number. Nothing is stored or written here.
 */
export const DASHBOARD_CHARTS: readonly DashboardChartDef[] = [
  {
    id: "seats_by_status",
    module: "inventory",
    title: "Seats by status",
    source: "seats",
    permissions: ["seats:manage"],
    emptyMessage: "No seats to chart yet.",
    categories: SEAT_STATUSES.map((status) => ({
      key: status,
      label: SEAT_STATUS_LABEL[status],
      filters: { status },
      tone: SEAT_TONE[status],
    })),
  },
  {
    id: "bookings_by_status",
    module: "bookings",
    title: "Bookings by status",
    source: "bookings",
    permissions: BOOKINGS_ACCESS_PERMISSIONS,
    emptyMessage: "No bookings to chart yet.",
    categories: BOOKING_STATUSES.map((status) => ({
      key: status,
      label: BOOKING_STATUS_LABEL[status],
      filters: { status },
      tone: BOOKING_TONE[status],
    })),
  },
  {
    id: "jobs_by_status",
    module: "jobs",
    title: "Jobs by status",
    source: "technician_jobs",
    permissions: JOBS_ACCESS_PERMISSIONS,
    emptyMessage: "No jobs to chart yet.",
    categories: JOB_STATUSES.map((status) => ({
      key: status,
      label: JOB_STATUS_LABEL[status],
      filters: { status },
      tone: JOB_TONE[status],
    })),
  },
  {
    id: "open_incidents_by_severity",
    module: "incidents",
    title: "Open incidents by severity",
    source: "incidents",
    permissions: INCIDENTS_ACCESS_PERMISSIONS,
    emptyMessage: "No open incidents.",
    categories: SEVERITIES_BY_WEIGHT.map((severity) => ({
      key: severity,
      label: INCIDENT_SEVERITY_LABEL[severity],
      filters: { status: "open", severity },
      tone: SEVERITY_TONE[severity],
      emphasis: severity === "critical",
    })),
  },
];

/** The charts a role may see: those of the modules it can open. */
export function getChartsForRole(role: Role): DashboardChartDef[] {
  return DASHBOARD_CHARTS.filter((chart) => hasAnyPermission(role, chart.permissions));
}
