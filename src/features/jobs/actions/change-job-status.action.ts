"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAnyPermission } from "@/lib/auth/current-user";
import { JOB_STATUS_UPDATE_PERMISSIONS } from "@/lib/auth/permissions";
import { changeJobStatusSchema } from "@/features/jobs/schemas/change-job-status.schema";
import { isJobReasonRequired } from "@/features/jobs/lib/job-status";
import {
  VALIDATION_ERROR,
  mapJobError,
  type JobActionResult,
} from "@/features/jobs/lib/job-errors";

/**
 * Status changes go only through `public.change_technician_job_status()`,
 * which validates the transition under a row lock and (via trigger) writes
 * the audit event atomically. Never a direct `update({ status })`: the guard
 * trigger rejects it.
 */
export async function changeJobStatusAction(
  input: unknown,
): Promise<JobActionResult> {
  await requireAnyPermission(JOB_STATUS_UPDATE_PERMISSIONS);

  const parsed = changeJobStatusSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_technician_job_status", {
    p_job_id: parsed.data.job_id,
    p_from_status: parsed.data.from_status,
    p_to_status: parsed.data.to_status,
    // A reason is only meaningful (and shown) for a cancel.
    p_reason: isJobReasonRequired(parsed.data.to_status)
      ? parsed.data.reason
      : undefined,
  });

  if (error) {
    return { success: false, error: mapJobError(error) };
  }

  return { success: true };
}
