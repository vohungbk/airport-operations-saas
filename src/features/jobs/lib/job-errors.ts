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

const INTERNAL_ERROR: JobActionError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again.",
};

/**
 * `JB001` inactive/non-technician assignee and `JB002` inactive booking are
 * raised by the insert guard trigger; `23505` is the open-job unique index;
 * `23503`/`22P02` are bad ids; `42501` is an RLS denial.
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
      return VALIDATION_ERROR;
    case "42501":
      return FORBIDDEN_ERROR;
    default:
      return INTERNAL_ERROR;
  }
}
