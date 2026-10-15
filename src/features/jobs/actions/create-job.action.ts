"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/current-user";
import { createJobSchema } from "@/features/jobs/schemas/create-job.schema";
import {
  VALIDATION_ERROR,
  mapJobError,
  type JobActionResult,
} from "@/features/jobs/lib/job-errors";

/**
 * Only `job_type`, `technician_id` and `booking_id` are inserted; status and
 * timestamps come from column defaults. Assignee and booking validity are
 * enforced by the insert guard trigger, RLS limits the caller to
 * admin/operations_manager.
 */
export async function createJobAction(
  input: unknown,
): Promise<JobActionResult> {
  await requirePermission("technicians:manage");

  const parsed = createJobSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_jobs")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    return { success: false, error: mapJobError(error) };
  }

  redirect(`/jobs/${data.id}`);
}
