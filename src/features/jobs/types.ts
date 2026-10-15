import type { JobStatus } from "@/features/jobs/lib/job-status";
import type { JobType } from "@/features/jobs/lib/job-type";

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

/**
 * Job detail for the person doing the work: the job plus only the booking,
 * airport and seat information needed to perform it. No pricing, revenue
 * share, partner or free-text booking notes (see `get-job-by-id.ts`).
 */
export interface JobDetailItem {
  id: string;
  status: JobStatus;
  job_type: JobType;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  vehicle_bay: string | null;
  installation_notes: string | null;
  technician: { id: string; full_name: string } | null;
  booking: {
    booking_number: string;
    pickup_at: string;
    return_at: string;
    vehicle: string | null;
    vehicle_bay: string | null;
    child_age_band: string | null;
    child_height: number | null;
    airport: { code: string; name: string } | null;
    seat: {
      serial_number: string;
      category: { name: string } | null;
    } | null;
  } | null;
}
