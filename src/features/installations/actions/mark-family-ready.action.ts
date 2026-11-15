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
  FAMILY_READY_DONE_ERROR,
  FAMILY_READY_NOT_READY_ERROR,
  INSTALLATION_REQUIRED_ERROR,
  mapFamilyReadyError,
} from "@/features/installations/lib/installation-errors";
import {
  getFamilyReadyState,
  moveBookingToStep,
} from "@/features/installations/lib/family-ready";
import { recordInstallationJobSchema } from "@/features/installations/schemas/record-installation.schema";

/**
 * Marks the vehicle of an installation job Family Ready (FO-F07-S07). It only moves the booking to the
 * Family Ready step through `move_booking_to_next_step()`: the database checks that the caller is the
 * assigned technician (or a manager), moves the seat status with the step, and stamps the time and the
 * actor (`bookings.family_ready_at`, `family_ready_by`). Marking it twice is refused: the booking is
 * already past the step. Today's jobs is shown afterwards.
 */
export async function markFamilyReadyAction(
  input: unknown,
): Promise<JobActionResult> {
  await requireAnyPermission(INSTALLATION_RECORD_PERMISSIONS);

  const parsed = recordInstallationJobSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const context = await getInstallationContext(parsed.data.job_id);

  if (!context) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  if (!context.installation) {
    return { success: false, error: INSTALLATION_REQUIRED_ERROR };
  }

  const state = getFamilyReadyState(context.booking.status);

  if (state !== "markable") {
    return {
      success: false,
      error:
        state === "already"
          ? FAMILY_READY_DONE_ERROR
          : FAMILY_READY_NOT_READY_ERROR,
    };
  }

  const supabase = await createClient();
  const error = await moveBookingToStep(
    supabase,
    context.booking.id,
    context.booking.status,
    "family_ready",
  );

  if (error) {
    return { success: false, error: mapFamilyReadyError(error) };
  }

  redirect("/technician");
}
