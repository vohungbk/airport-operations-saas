import type { JobStatus } from "@/features/jobs/lib/job-status";

/** One row of the job list: the job plus its booking and technician. */
export interface JobListItem {
  id: string;
  status: JobStatus;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  vehicle_bay: string | null;
  booking: { id: string; booking_number: string } | null;
  technician: { id: string; full_name: string } | null;
}

export interface TechnicianOption {
  id: string;
  full_name: string;
}
