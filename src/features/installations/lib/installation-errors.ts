import type { PostgrestError } from "@supabase/supabase-js";

import {
  mapJobError,
  type JobActionError,
} from "@/features/jobs/lib/job-errors";

const ALREADY_RECORDED_ERROR: JobActionError = {
  code: "ALREADY_RECORDED",
  message: "An installation is already recorded for this job.",
};

const JOB_NOT_ELIGIBLE_ERROR: JobActionError = {
  code: "JOB_NOT_ELIGIBLE",
  message: "An installation can only be recorded on an active installation job.",
};

export const SEAT_REQUIRED_ERROR: JobActionError = {
  code: "SEAT_NOT_ELIGIBLE",
  message: "This job's booking has no seat assigned yet.",
};

export const SEAT_WRONG_CATEGORY_ERROR: JobActionError = {
  code: "SEAT_NOT_ELIGIBLE",
  message: "The assigned seat is not the category this booking requires.",
};

const SCAN_REQUIRED_ERROR: JobActionError = {
  code: "SCAN_REQUIRED",
  message: "Scan the seat QR code and verify the seat before completing the installation.",
};

export const INSTALLATION_REQUIRED_ERROR: JobActionError = {
  code: "JOB_NOT_ELIGIBLE",
  message: "Record the installation before marking the vehicle Family Ready.",
};

export const FAMILY_READY_DONE_ERROR: JobActionError = {
  code: "ALREADY_RECORDED",
  message: "This vehicle is already marked Family Ready.",
};

export const FAMILY_READY_NOT_READY_ERROR: JobActionError = {
  code: "INVALID_TRANSITION",
  message: "This booking is not at a step where the vehicle can be marked Family Ready.",
};

const BOOKING_CHANGED_ERROR: JobActionError = {
  code: "STALE_DATA",
  message: "This booking was changed by someone else. Reload the page and try again.",
};

const SEAT_NOT_ELIGIBLE_ERROR: JobActionError = {
  code: "SEAT_NOT_ELIGIBLE",
  message: "The seat is not in a status that allows installation.",
};

/**
 * True when someone else recorded this job first (the unique index fired):
 * the page should then show the existing record, not the form.
 */
export function isAlreadyRecordedError(
  error: JobActionError | undefined,
): boolean {
  return error?.code === ALREADY_RECORDED_ERROR.code;
}

/**
 * `JB005` not an installation job and `JB006` job not active are raised by
 * the insert guard trigger; `JB007` is a missing or ineligible seat; `JB013` the seat was not scanned and verified;
 * `23505` is the one-installation-per-job unique index. Everything else is
 * handled like any other job error (forbidden, not found, bad input).
 */
export function mapInstallationError(error: PostgrestError): JobActionError {
  switch (error.code) {
    case "JB005":
    case "JB006":
      return JOB_NOT_ELIGIBLE_ERROR;
    case "JB007":
      return SEAT_NOT_ELIGIBLE_ERROR;
    case "JB013":
      return SCAN_REQUIRED_ERROR;
    case "23505":
      return ALREADY_RECORDED_ERROR;
    default:
      return mapJobError(error);
  }
}

/**
 * An error of `move_booking_to_next_step()` for the Family Ready action: `BK007` the booking was moved
 * by someone else, `BK008` no seat and `BK009` the seat is not ready are seat problems, `55000` the
 * step cannot be skipped. Everything else is handled like any other job error.
 */
export function mapFamilyReadyError(error: PostgrestError): JobActionError {
  switch (error.code) {
    case "BK007":
      return BOOKING_CHANGED_ERROR;
    case "BK008":
    case "BK009":
      return SEAT_NOT_ELIGIBLE_ERROR;
    case "55000":
      return FAMILY_READY_NOT_READY_ERROR;
    default:
      return mapJobError(error);
  }
}
