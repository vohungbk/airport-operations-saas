import { getCleaningContext } from "@/features/cleaning/lib/get-cleaning-context";
import { getInspectionContext } from "@/features/inspections/lib/get-inspection-context";
import { getInstallationContext } from "@/features/installations/lib/get-installation-context";
import type { StepDone, StepName } from "@/features/jobs/lib/step-done";

interface Context {
  job: { id: string };
  booking: {
    booking_number: string;
    airport: { code: string; timezone: string };
    seat: { serial_number: string; category_name: string | null } | null;
  };
}

function toStepDone(
  step: StepName,
  context: Context,
  record: { completed_at: string; recorded_by: string | null },
): StepDone {
  return {
    step,
    job_id: context.job.id,
    booking_number: context.booking.booking_number,
    airport: {
      code: context.booking.airport.code,
      timezone: context.booking.airport.timezone,
    },
    seat: context.booking.seat && {
      serial_number: context.booking.seat.serial_number,
      category_name: context.booking.seat.category_name,
    },
    completed_by: record.recorded_by,
    completed_at: record.completed_at,
  };
}

/**
 * Server-only. The step of a job as done, read from its record: `null` when there is no such record (the
 * step is not done), the job is unknown, or RLS hides it (another technician's). The screen never trusts the
 * address for the fact that a step is done; it reads it.
 */
export async function getStepDone(
  jobId: string,
  step: StepName,
): Promise<StepDone | null> {
  if (step === "installation") {
    const context = await getInstallationContext(jobId);
    const record = context?.installation;

    return context && record
      ? toStepDone(step, context, {
          completed_at: record.completed_at ?? record.created_at,
          recorded_by: record.recorded_by,
        })
      : null;
  }

  if (step === "cleaning") {
    const context = await getCleaningContext(jobId);
    const record = context?.cleaning;

    return context && record?.completed_at
      ? toStepDone(step, context, {
          completed_at: record.completed_at,
          recorded_by: record.recorded_by,
        })
      : null;
  }

  const context = await getInspectionContext(jobId);
  const record = context?.inspection;

  return context && record
    ? toStepDone(step, context, {
        completed_at: record.created_at,
        recorded_by: record.recorded_by,
      })
    : null;
}
