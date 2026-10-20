import type { PostgrestError } from "@supabase/supabase-js";

import {
  VALIDATION_ERROR,
  type JobActionError,
} from "@/features/jobs/lib/job-errors";

const FORBIDDEN_ERROR: JobActionError = {
  code: "FORBIDDEN",
  message: "You do not have permission to change this incident.",
};

// One message for "does not exist" and "not within your access": RLS hides
// both the same way, and it must not reveal that the incident exists.
export const INCIDENT_NOT_FOUND_ERROR: JobActionError = {
  code: "NOT_FOUND",
  message: "This incident was not found or is not within your access.",
};

const INVALID_TRANSITION_ERROR: JobActionError = {
  code: "INVALID_TRANSITION",
  message: "This change is not allowed for the incident in its current status.",
};

const STALE_DATA_ERROR: JobActionError = {
  code: "STALE_DATA",
  message:
    "This incident was changed by someone else. The latest status is shown; review it and try again.",
};

const INTERNAL_ERROR: JobActionError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again.",
};

/** True when the incident is out of the caller's reach, so a retry is pointless. */
export function isIncidentUnavailableError(
  error: JobActionError | undefined,
): boolean {
  return error?.code === "NOT_FOUND" || error?.code === "FORBIDDEN";
}

/**
 * `42501` the role cannot change incidents; `P0002` incident not found;
 * `55000` invalid transition; `JB004` the status changed since the caller
 * loaded it; `22023` a status or a required note is missing, or the note is
 * too long. Everything else is internal; raw database text never reaches the
 * client.
 */
export function mapIncidentError(error: PostgrestError): JobActionError {
  switch (error.code) {
    case "42501":
      return FORBIDDEN_ERROR;
    case "P0002":
      return INCIDENT_NOT_FOUND_ERROR;
    case "55000":
      return INVALID_TRANSITION_ERROR;
    case "JB004":
      return STALE_DATA_ERROR;
    case "22023":
    case "22P02":
      return VALIDATION_ERROR;
    default:
      return INTERNAL_ERROR;
  }
}
