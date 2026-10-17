"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireAnyPermission } from "@/lib/auth/current-user";
import { CLEANING_RECORD_PERMISSIONS } from "@/lib/auth/permissions";
import {
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  type JobActionResult,
} from "@/features/jobs/lib/job-errors";
import { getCleaningContext } from "@/features/cleaning/lib/get-cleaning-context";
import {
  SEAT_REQUIRED_ERROR,
  mapCleaningError,
} from "@/features/cleaning/lib/cleaning-errors";
import {
  buildRecordCleaningSchema,
  recordCleaningJobSchema,
  toCleanedAtIso,
} from "@/features/cleaning/schemas/record-cleaning.schema";

/**
 * The airport timezone and the seat come from the database, never from the
 * client: the time is read as wall-clock at the booking's airport, and the
 * submitted seat must be the booking's seat. The guard trigger on
 * `cleaning_records` re-validates the job and seat and sets `seat_id`,
 * `booking_id`, `employee_id` and `started_at` itself; the values sent for
 * the NOT NULL columns are only placeholders it overwrites.
 */
export async function recordCleaningAction(
  input: unknown,
): Promise<JobActionResult> {
  const user = await requireAnyPermission(CLEANING_RECORD_PERMISSIONS);

  const job = recordCleaningJobSchema.safeParse(input);

  if (!job.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const context = await getCleaningContext(job.data.job_id);

  if (!context) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  const parsed = buildRecordCleaningSchema(
    context.booking.airport.timezone,
  ).safeParse(input);

  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  if (!context.booking.seat) {
    return { success: false, error: SEAT_REQUIRED_ERROR };
  }

  const completedAt = toCleanedAtIso(
    parsed.data.cleaned_at,
    context.booking.airport.timezone,
  );

  if (parsed.data.seat_id !== context.booking.seat.id || !completedAt) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("cleaning_records").insert({
    technician_job_id: context.job.id,
    seat_id: context.booking.seat.id,
    employee_id: user.id,
    started_at: completedAt,
    completed_at: completedAt,
    notes: parsed.data.notes || null,
  });

  if (error) {
    return { success: false, error: mapCleaningError(error) };
  }

  redirect(`/jobs/${context.job.id}`);
}
