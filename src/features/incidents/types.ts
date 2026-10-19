import type { IncidentSeverity } from "@/features/incidents/lib/incident-severity";
import type { IncidentStatus } from "@/features/incidents/lib/incident-status";

/** One row of the incident list. */
export interface IncidentListItem {
  id: string;
  type: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  created_at: string;
  seat: { serial_number: string } | null;
  booking: { booking_number: string } | null;
  reporter: { full_name: string } | null;
}
