"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireAnyPermission } from "@/lib/auth/current-user";
import { INSTALLATION_RECORD_PERMISSIONS } from "@/lib/auth/permissions";
import {
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  type JobActionResult,
} from "@/features/jobs/lib/job-errors";
import { getInstallationContext } from "@/features/installations/lib/get-installation-context";
import {
  SEAT_REQUIRED_ERROR,
  mapInstallationError,
} from "@/features/installations/lib/installation-errors";
import {
  buildRecordInstallationSchema,
  recordInstallationJobSchema,
  toInstalledAtIso,
} from "@/features/installations/schemas/record-installation.schema";

/**
 * The airport timezone and the seat come from the database, never from the
 * client: the time is read as wall-clock at the booking's airport, and the
 * submitted seat must be the booking's seat. The guard trigger on
 * `installations` re-validates the job and seat and sets `seat_id` and
 * `created_by` itself.
 */
export async function recordInstallationAction(
  input: unknown,
): Promise<JobActionResult> {
  await requireAnyPermission(INSTALLATION_RECORD_PERMISSIONS);

  const job = recordInstallationJobSchema.safeParse(input);

  if (!job.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const context = await getInstallationContext(job.data.job_id);

  if (!context) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  const parsed = buildRecordInstallationSchema(
    context.booking.airport.timezone,
  ).safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  if (!context.booking.seat) {
    return { success: false, error: SEAT_REQUIRED_ERROR };
  }

  const completedAt = toInstalledAtIso(
    parsed.data.installed_at,
    context.booking.airport.timezone,
  );

  if (parsed.data.seat_id !== context.booking.seat.id || !completedAt) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("installations").insert({
    technician_job_id: context.job.id,
    completed_at: completedAt,
    notes: parsed.data.notes || null,
    installation_completed: true,
  });

  if (error) {
    return { success: false, error: mapInstallationError(error) };
  }

  redirect(`/jobs/${context.job.id}/done?step=installation`);
}
