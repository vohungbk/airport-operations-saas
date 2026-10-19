import { Constants, type Database } from "@/types/database.types";

export type IncidentSeverity = Database["public"]["Enums"]["incident_severity"];

/**
 * The `incident_severity` Postgres enum is the single source of truth; the
 * values come from the generated types so they cannot drift from the database.
 */
export const INCIDENT_SEVERITIES = [
  ...Constants.public.Enums.incident_severity,
] as [IncidentSeverity, ...IncidentSeverity[]];

/** A new enum value fails type-checking here until it gets a label. */
export const INCIDENT_SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};
