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

/**
 * Where an incident can go next; `closed` is terminal. Must stay in sync with
 * `public.change_incident_status()`, which is the enforcing authority.
 */
const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ["investigating", "resolved"],
  investigating: ["resolved"],
  resolved: ["closed", "investigating"],
  closed: [],
};

export function getAllowedIncidentTransitions(
  status: IncidentStatus,
): IncidentStatus[] {
  return INCIDENT_TRANSITIONS[status];
}

/** Reopening a resolved incident needs a note saying why. */
export function isIncidentNoteRequired(
  from: IncidentStatus,
  to: IncidentStatus,
): boolean {
  return from === "resolved" && to === "investigating";
}
