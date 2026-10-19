import { Constants, type Database } from "@/types/database.types";

export type IncidentStatus = Database["public"]["Enums"]["incident_status"];

/**
 * The `incident_status` Postgres enum is the single source of truth; the
 * values come from the generated types so they cannot drift from the database.
 */
export const INCIDENT_STATUSES = [
  ...Constants.public.Enums.incident_status,
] as [IncidentStatus, ...IncidentStatus[]];

/** A new enum value fails type-checking here until it gets a label. */
export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  resolved: "Resolved",
  closed: "Closed",
};
