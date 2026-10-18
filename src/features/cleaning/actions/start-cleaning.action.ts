"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAnyPermission } from "@/lib/auth/current-user";
import { CLEANING_RECORD_PERMISSIONS } from "@/lib/auth/permissions";
import {
  VALIDATION_ERROR,
  type JobActionResult,
} from "@/features/jobs/lib/job-errors";
import { mapCleaningError } from "@/features/cleaning/lib/cleaning-errors";
import { startCleaningSchema } from "@/features/cleaning/schemas/cleaning.schema";

/**
 * Starts the cleaning: the database function moves the seat to `cleaning`
 * and creates the record in one transaction. It checks the caller (the
 * assigned technician, admin or operations manager), the job, the seat and
 * other bookings itself; this action only validates the input and maps the
 * errors. The time is the server's.
 */
export async function startCleaningAction(
  input: unknown,
): Promise<JobActionResult> {
  await requireAnyPermission(CLEANING_RECORD_PERMISSIONS);

  const parsed = startCleaningSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_cleaning", {
    p_job_id: parsed.data.job_id,
  });

  if (error) {
    return { success: false, error: mapCleaningError(error) };
  }

  return { success: true };
}
