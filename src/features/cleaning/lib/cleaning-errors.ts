import type { PostgrestError } from "@supabase/supabase-js";

import {
  mapJobError,
  type JobActionError,
} from "@/features/jobs/lib/job-errors";

const ALREADY_RECORDED_ERROR: JobActionError = {
  code: "ALREADY_RECORDED",
  message: "A cleaning is already recorded for this job.",
};

const JOB_NOT_ELIGIBLE_ERROR: JobActionError = {
  code: "JOB_NOT_ELIGIBLE",
  message: "A cleaning can only be recorded on an active cleaning job.",
};

export const SEAT_REQUIRED_ERROR: JobActionError = {
  code: "SEAT_NOT_ELIGIBLE",
  message: "This job's booking has no seat assigned yet.",
};

const SEAT_NOT_ELIGIBLE_ERROR: JobActionError = {
  code: "SEAT_NOT_ELIGIBLE",
  message: "The seat is retired, so a cleaning cannot be recorded.",
};

/**
 * True when someone else recorded this job first (the unique index fired):
 * the screen then keeps the user's entry and offers the recorded cleaning.
 */
export function isAlreadyRecordedError(
  error: JobActionError | undefined,
): boolean {
  return error?.code === ALREADY_RECORDED_ERROR.code;
}

/**
 * `JB005` not a cleaning job and `JB006` job not active are raised by the
 * insert guard trigger; `JB007` is a missing or retired seat; `23505` is the
 * one-cleaning-per-job unique index. Everything else is handled like any
 * other job error (forbidden, not found, bad input).
 */
export function mapCleaningError(error: PostgrestError): JobActionError {
  switch (error.code) {
    case "JB005":
    case "JB006":
      return JOB_NOT_ELIGIBLE_ERROR;
    case "JB007":
      return SEAT_NOT_ELIGIBLE_ERROR;
    case "23505":
      return ALREADY_RECORDED_ERROR;
    default:
      return mapJobError(error);
  }
}
