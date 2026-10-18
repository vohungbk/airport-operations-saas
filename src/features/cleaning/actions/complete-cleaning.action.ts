"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireAnyPermission } from "@/lib/auth/current-user";
import { CLEANING_RECORD_PERMISSIONS } from "@/lib/auth/permissions";
import {
  VALIDATION_ERROR,
  type JobActionResult,
} from "@/features/jobs/lib/job-errors";
import { mapCleaningError } from "@/features/cleaning/lib/cleaning-errors";
import { completeCleaningSchema } from "@/features/cleaning/schemas/cleaning.schema";

/**
 * Completes the cleaning with its result. The database function records the
 * result once and moves the seat: available when it passed, quarantine when
 * it failed or the seat has an unresolved incident. It checks the caller and
 * the state itself; this action only validates the input and maps the
 * errors.
 */
export async function completeCleaningAction(
  input: unknown,
): Promise<JobActionResult> {
  await requireAnyPermission(CLEANING_RECORD_PERMISSIONS);

  const parsed = completeCleaningSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_cleaning", {
    p_job_id: parsed.data.job_id,
    p_passed: parsed.data.result === "passed",
    p_notes: parsed.data.notes || undefined,
  });

  if (error) {
    return { success: false, error: mapCleaningError(error) };
  }

  redirect(`/jobs/${parsed.data.job_id}`);
}
