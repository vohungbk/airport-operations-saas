import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Stable error shape for the job Server Actions. Raw Postgres errors never
 * reach the client.
 */
export interface JobActionError {
  code:
    | "VALIDATION_ERROR"
    | "FORBIDDEN"
    | "TECHNICIAN_INACTIVE"
    | "BOOKING_NOT_ACTIVE"
    | "DUPLICATE_JOB"
    | "NOT_FOUND"
    | "INVALID_TRANSITION"
    | "STALE_DATA"
    | "NETWORK_ERROR"
    | "ALREADY_RECORDED"
    | "JOB_NOT_ELIGIBLE"
    | "SEAT_NOT_ELIGIBLE"
    | "SEAT_IN_USE"
    | "NOT_STARTED"
    | "INTERNAL_ERROR";
  message: string;
}

export interface JobActionResult {
  success: boolean;
  error?: JobActionError;
}

export const VALIDATION_ERROR: JobActionError = {
  code: "VALIDATION_ERROR",
  message: "Check the form and try again.",
};

const FORBIDDEN_ERROR: JobActionError = {
  code: "FORBIDDEN",
  message: "You do not have permission to do this.",
};

const TECHNICIAN_INACTIVE_ERROR: JobActionError = {
  code: "TECHNICIAN_INACTIVE",
  message: "This technician is not active and cannot be assigned a job.",
};

const BOOKING_NOT_ACTIVE_ERROR: JobActionError = {
  code: "BOOKING_NOT_ACTIVE",
  message: "This booking is no longer active, so a job cannot be created.",
};

const DUPLICATE_JOB_ERROR: JobActionError = {
  code: "DUPLICATE_JOB",
  message: "An open job of this type already exists for this booking.",
};

// One message for "does not exist" and "no longer assigned to you": RLS
// hides both the same way, and it must not reveal that the job exists.
export const NOT_FOUND_ERROR: JobActionError = {
  code: "NOT_FOUND",
  message: "This job was not found or is no longer assigned to you.",
};

const INVALID_TRANSITION_ERROR: JobActionError = {
  code: "INVALID_TRANSITION",
  message: "This change is not allowed for the job in its current state.",
};

const STALE_DATA_ERROR: JobActionError = {
  code: "STALE_DATA",
  message:
    "This job was changed by someone else. The latest status is shown; review it and try again.",
};

/** Raised on the client when the call itself failed; never from the database. */
export const NETWORK_ERROR: JobActionError = {
  code: "NETWORK_ERROR",
  message:
    "Could not reach the server. Your input is kept; check your connection and try again.",
};

const INTERNAL_ERROR: JobActionError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again.",
};

/**
 * True when the job is out of the caller's reach (unassigned, hidden by RLS
 * or the role no longer allows it), so retrying the same action is pointless.
 */
export function isJobUnavailableError(
  error: JobActionError | undefined,
): boolean {
  return error?.code === "NOT_FOUND" || error?.code === "FORBIDDEN";
}

/**
 * `JB001` inactive/non-technician assignee and `JB002` inactive booking are
 * raised by the job guard triggers; `23505` is the open-job unique index;
 * `23503`/`22P02`/`22023` are bad input; `42501` is an RLS/role denial;
 * `P0002` job not found (or hidden by RLS); `55000` invalid transition;
 * `JB004` the job changed since the caller loaded it.
 */
export function mapJobError(error: PostgrestError): JobActionError {
  switch (error.code) {
    case "JB001":
      return TECHNICIAN_INACTIVE_ERROR;
    case "JB002":
      return BOOKING_NOT_ACTIVE_ERROR;
    case "23505":
      return DUPLICATE_JOB_ERROR;
    case "23503":
    case "22P02":
    case "22023":
      return VALIDATION_ERROR;
    case "P0002":
      return NOT_FOUND_ERROR;
    case "55000":
      return INVALID_TRANSITION_ERROR;
    case "JB004":
      return STALE_DATA_ERROR;
    case "42501":
      return FORBIDDEN_ERROR;
    default:
      return INTERNAL_ERROR;
  }
}
