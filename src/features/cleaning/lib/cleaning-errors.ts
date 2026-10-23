import type { PostgrestError } from "@supabase/supabase-js";

import {
  mapJobError,
  type JobActionError,
} from "@/features/jobs/lib/job-errors";

const ALREADY_RECORDED_ERROR: JobActionError = {
  code: "ALREADY_RECORDED",
  message: "Someone else already did this step for this cleaning.",
};

const JOB_NOT_ELIGIBLE_ERROR: JobActionError = {
  code: "JOB_NOT_ELIGIBLE",
  message: "A cleaning can only be done on an active cleaning job.",
};

const SEAT_REQUIRED_ERROR: JobActionError = {
  code: "SEAT_NOT_ELIGIBLE",
  message: "This job's booking has no seat assigned yet.",
};

const SEAT_NOT_AVAILABLE_ERROR: JobActionError = {
  code: "SEAT_NOT_ELIGIBLE",
  message: "The seat is not available for cleaning.",
};

const SEAT_IN_USE_ERROR: JobActionError = {
  code: "SEAT_IN_USE",
  message:
    "Another booking holds or uses the seat now or soon. Handle that booking first, then start the cleaning.",
};

const NOT_STARTED_ERROR: JobActionError = {
  code: "NOT_STARTED",
  message: "The cleaning has not been started yet.",
};

const SEAT_CHANGED_ERROR: JobActionError = {
  code: "SEAT_NOT_ELIGIBLE",
  message: "The seat is no longer being cleaned. Reload the page.",
};

/**
 * True when someone else got there first (`23505` the cleaning is already
 * started, `JB011` it is already completed): the screen then keeps the
 * user's entry and offers the cleaning that was kept.
 */
export function isAlreadyRecordedError(
  error: JobActionError | undefined,
): boolean {
  return error?.code === ALREADY_RECORDED_ERROR.code;
}

/**
 * Codes raised by `start_cleaning()` and `complete_cleaning()`:
 * `JB005` not a cleaning job, `JB006` job not active, `JB007` no seat,
 * `JB008` seat not available, `JB009` a booking holds or uses the seat in the cleaning period,
 * `JB010` not started, `JB011` already completed, `JB012` the seat is no
 * longer being cleaned, `23505` already started. Everything else is handled
 * like any other job error (forbidden, not found, bad input).
 */
export function mapCleaningError(error: PostgrestError): JobActionError {
  switch (error.code) {
    case "JB005":
    case "JB006":
      return JOB_NOT_ELIGIBLE_ERROR;
    case "JB007":
      return SEAT_REQUIRED_ERROR;
    case "JB008":
      return SEAT_NOT_AVAILABLE_ERROR;
    case "JB009":
      return SEAT_IN_USE_ERROR;
    case "JB010":
      return NOT_STARTED_ERROR;
    case "JB011":
    case "23505":
      return ALREADY_RECORDED_ERROR;
    case "JB012":
      return SEAT_CHANGED_ERROR;
    default:
      return mapJobError(error);
  }
}
