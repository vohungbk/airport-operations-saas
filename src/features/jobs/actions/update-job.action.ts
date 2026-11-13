"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { updateJobSchema } from "@/features/jobs/schemas/update-job.schema";
import {
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  mapJobError,
  type JobActionResult,
} from "@/features/jobs/lib/job-errors";

/**
 * Only `job_type` and `technician_id` are written. The booking cannot change
 * and the status has its own action; the update guard trigger enforces both
 * and checks that a new technician is active. RLS limits the caller to
 * admin/operations_manager, and an empty result means the job is gone or
 * hidden.
 */
export async function updateJobAction(
  input: unknown,
): Promise<JobActionResult> {
  await requirePermission("technicians:manage");

  const parsed = updateJobSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const { id, ...changes } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_jobs")
    .update(changes)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { success: false, error: mapJobError(error) };
  }

  if (!data) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  redirect(`/jobs/${data.id}?saved=job`);
}
