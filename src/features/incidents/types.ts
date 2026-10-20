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

/**
 * The incident detail: the incident and the names of what it refers to.
 * Deliberately absent: partner contact and commercial data, user emails.
 */
export interface IncidentDetailItem {
  id: string;
  type: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  technician_job_id: string | null;
  partner: { name: string } | null;
  seat: { serial_number: string } | null;
  booking: { booking_number: string } | null;
  reporter: { full_name: string } | null;
  resolver: { full_name: string } | null;
}

/** One entry of the incident history: a status change. */
export interface IncidentHistoryItem {
  id: string;
  from_status: IncidentStatus | null;
  to_status: IncidentStatus;
  notes: string | null;
  created_at: string;
  actor_name: string | null;
}
