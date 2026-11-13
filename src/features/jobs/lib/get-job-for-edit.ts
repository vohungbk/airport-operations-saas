import { createClient } from "@/lib/supabase/server";
import { jobIdSchema } from "@/features/jobs/schemas/jobs-query.schema";
import type { JobStatus } from "@/features/jobs/lib/job-status";
import type { JobType } from "@/features/jobs/lib/job-type";

export interface JobForEdit {
  id: string;
  job_number: string;
  status: JobStatus;
  job_type: JobType;
  technician_id: string;
  updated_at: string;
  booking: {
    id: string;
    booking_number: string;
    airport: { timezone: string } | null;
  };
}

const JOB_FOR_EDIT_SELECT = [
  "id",
  "job_number",
  "status",
  "job_type",
  "technician_id",
  "updated_at",
  "booking:bookings!inner(id, booking_number, airport:airports(timezone))",
].join(", ");

/**
 * Server-only. The few fields the Edit screen shows. `null` for a malformed
 * id or a job RLS hides, so the caller shows the same not-found page for both.
 */
export async function getJobForEdit(id: string): Promise<JobForEdit | null> {
  if (!jobIdSchema.safeParse(id).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_jobs")
    .select(JOB_FOR_EDIT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as JobForEdit | null;
}
