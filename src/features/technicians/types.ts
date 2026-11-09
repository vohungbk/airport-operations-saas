import type { JobStatus } from "@/features/jobs/lib/job-status";
import type { JobType } from "@/features/jobs/lib/job-type";

/**
 * A technician is a `public.users` row with `role = 'technician'` (there
 * is no separate technicians table). Only the columns the list and detail
 * screens render are selected.
 */
export interface Technician {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

/** One row of the job table on the technician detail page. */
export interface TechnicianJobRow {
  id: string;
  job_number: string;
  job_type: JobType;
  status: JobStatus;
  updated_at: string;
  booking_number: string | null;
  seat_serial_number: string | null;
  /** Time zone of the booking airport; `UTC` when the booking has none. */
  timezone: string;
}

/** What the detail page shows besides the technician: figures, airport, jobs. */
export interface TechnicianActivity {
  /** Airport of the most recently assigned job; null until the first job. */
  airport: { name: string; code: string; timezone: string } | null;
  open_jobs: number;
  jobs_done_this_week: number;
  jobs: TechnicianJobRow[];
}

/** A technician with the figures the list shows next to the name. */
export interface TechnicianListRow extends Technician {
  /** Airport of the most recently assigned job; null until the first job. */
  airport_name: string | null;
  airport_code: string | null;
  open_jobs: number;
  jobs_done_this_week: number;
}
