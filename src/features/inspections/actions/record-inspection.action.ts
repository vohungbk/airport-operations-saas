"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireAnyPermission } from "@/lib/auth/current-user";
import { INSPECTION_RECORD_PERMISSIONS } from "@/lib/auth/permissions";
import {
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  type JobActionResult,
} from "@/features/jobs/lib/job-errors";
import { getInspectionContext } from "@/features/inspections/lib/get-inspection-context";
import {
  SEAT_REQUIRED_ERROR,
  mapInspectionError,
} from "@/features/inspections/lib/inspection-errors";
import { recordInspectionSchema } from "@/features/inspections/schemas/record-inspection.schema";

/**
 * The seat comes from the database, never from the client: the submitted seat
 * must be the booking's seat. The guard trigger on `inspection_records`
 * re-validates the job and seat and sets `seat_id`, `booking_id`,
 * `inspector_id` and `inspection_type` itself; the values sent for the NOT
 * NULL columns are only placeholders it overwrites.
 */
export async function recordInspectionAction(
  input: unknown,
): Promise<JobActionResult> {
  const user = await requireAnyPermission(INSPECTION_RECORD_PERMISSIONS);

  const parsed = recordInspectionSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const context = await getInspectionContext(parsed.data.job_id);

  if (!context) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  if (!context.booking.seat) {
    return { success: false, error: SEAT_REQUIRED_ERROR };
  }

  if (parsed.data.seat_id !== context.booking.seat.id) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inspection_records").insert({
    technician_job_id: context.job.id,
    seat_id: context.booking.seat.id,
    inspector_id: user.id,
    inspection_type: "general",
    result: parsed.data.result,
    notes: parsed.data.notes || null,
  });

  if (error) {
    return { success: false, error: mapInspectionError(error) };
  }

  redirect(`/jobs/${context.job.id}`);
}
