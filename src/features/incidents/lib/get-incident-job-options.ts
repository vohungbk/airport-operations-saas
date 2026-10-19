import { createClient } from "@/lib/supabase/server";
import type { JobType } from "@/features/jobs/lib/job-type";

export interface IncidentJobOption {
  id: string;
  job_type: JobType;
  booking_number: string;
}

export const INCIDENT_JOB_OPTIONS_LIMIT = 100;

interface Row {
  id: string;
  job_type: JobType;
  booking: { booking_number: string } | null;
}

/**
 * Server-only. The jobs the user may report an incident on: RLS gives a
 * technician their own jobs and a manager every job. Cancelled jobs are left
 * out; the newest come first and the list is capped.
 */
export async function getIncidentJobOptions(): Promise<IncidentJobOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_jobs")
    .select("id, job_type, booking:bookings!inner(booking_number)")
    .neq("status", "cancelled")
    .order("assigned_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(INCIDENT_JOB_OPTIONS_LIMIT);

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    job_type: row.job_type,
    booking_number: row.booking?.booking_number ?? "",
  }));
}
