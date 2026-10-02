import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Stable, machine-readable error shape shared by every booking Server
 * Action. Raw Postgres errors never reach the client, and messages never
 * name another partner's booking.
 */
export interface BookingActionError {
  code:
    | "VALIDATION_ERROR"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "INVALID_TRANSITION"
    | "SEAT_UNAVAILABLE"
    | "SEAT_CONFLICT"
    | "SEAT_CATEGORY_MISMATCH"
    | "SEAT_NOT_FOUND"
    | "STALE_DATA"
    | "INTERNAL_ERROR";
  message: string;
}

/** Result shape shared by every booking Server Action and its form hook. */
export interface BookingActionResult {
  success: boolean;
  error?: BookingActionError;
}

export const VALIDATION_ERROR: BookingActionError = {
  code: "VALIDATION_ERROR",
  message: "Check the form and try again.",
};

const FORBIDDEN_ERROR: BookingActionError = {
  code: "FORBIDDEN",
  message: "You do not have permission to do this.",
};

export const NOT_FOUND_ERROR: BookingActionError = {
  code: "NOT_FOUND",
  message: "Booking not found.",
};

export const AIRPORT_NOT_FOUND_ERROR: BookingActionError = {
  code: "NOT_FOUND",
  message: "Airport not found or not accessible. Reload the page and try again.",
};

export const INVALID_TRANSITION_ERROR: BookingActionError = {
  code: "INVALID_TRANSITION",
  message: "This change is not allowed for the booking in its current state.",
};

export const SEAT_UNAVAILABLE_ERROR: BookingActionError = {
  code: "SEAT_UNAVAILABLE",
  message: "The selected seat is not available.",
};

export const SEAT_CONFLICT_ERROR: BookingActionError = {
  code: "SEAT_CONFLICT",
  message: "The selected seat is already booked for an overlapping period.",
};

export const SEAT_CATEGORY_MISMATCH_ERROR: BookingActionError = {
  code: "SEAT_CATEGORY_MISMATCH",
  message: "The selected seat does not match the booking airport or category.",
};

export const SEAT_NOT_FOUND_ERROR: BookingActionError = {
  code: "SEAT_NOT_FOUND",
  message: "The selected seat was not found.",
};

export const STALE_DATA_ERROR: BookingActionError = {
  code: "STALE_DATA",
  message:
    "This booking was changed by someone else. Reload the page and try again.",
};

export const INTERNAL_ERROR: BookingActionError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again.",
};

/**
 * `23514` CHECK, `23503` FK and `22P02` bad text are bad input; `42501` is
 * an RLS/role denial. The rest are raised by the booking RPCs: `22023`
 * invalid input, `P0002` not found, `55000` invalid state/transition,
 * `BK001` seat not available, `BK002` seat time conflict, `BK003`
 * category/airport mismatch, `BK004` stale `expected_updated_at`, `BK005` seat not found.
 */
export function mapBookingError(error: PostgrestError): BookingActionError {
  switch (error.code) {
    case "23514":
    case "23503":
    case "22023":
    case "22P02":
      return VALIDATION_ERROR;
    case "42501":
      return FORBIDDEN_ERROR;
    case "P0002":
      return NOT_FOUND_ERROR;
    case "55000":
      return INVALID_TRANSITION_ERROR;
    case "BK001":
      return SEAT_UNAVAILABLE_ERROR;
    case "BK002":
      return SEAT_CONFLICT_ERROR;
    case "BK003":
      return SEAT_CATEGORY_MISMATCH_ERROR;
    case "BK005":
      return SEAT_NOT_FOUND_ERROR;
    case "BK004":
      return STALE_DATA_ERROR;
    default:
      return INTERNAL_ERROR;
  }
}
