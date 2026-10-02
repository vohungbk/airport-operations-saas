import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Stable, machine-readable error shape shared by every seat Server
 * Action. Raw Postgres errors never reach the client.
 */
export interface SeatActionError {
  code:
    | "VALIDATION_ERROR"
    | "DUPLICATE_SERIAL"
    | "INVALID_TRANSITION"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "INTERNAL_ERROR";
  message: string;
}

export const VALIDATION_ERROR: SeatActionError = {
  code: "VALIDATION_ERROR",
  message: "Check the form and try again.",
};

export const INACTIVE_CATEGORY_ERROR: SeatActionError = {
  code: "VALIDATION_ERROR",
  message: "Select an active seat category.",
};

export const DUPLICATE_SERIAL_ERROR: SeatActionError = {
  code: "DUPLICATE_SERIAL",
  message: "A seat with this serial number already exists.",
};

export const INVALID_TRANSITION_ERROR: SeatActionError = {
  code: "INVALID_TRANSITION",
  message: "This status change is not allowed for the seat.",
};

export const FORBIDDEN_ERROR: SeatActionError = {
  code: "FORBIDDEN",
  message: "You do not have permission to do this.",
};

export const NOT_FOUND_ERROR: SeatActionError = {
  code: "NOT_FOUND",
  message: "Seat not found.",
};

export const INTERNAL_ERROR: SeatActionError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again.",
};

/**
 * `23505` is only a duplicate serial when the violated constraint is the
 * serial_number one (`public_token` is DB-generated, never user input).
 * `23514` CHECK and `23503` FK (unknown category/airport) are bad input,
 * `42501` is an RLS denial. `P0002`, `55000` and `22023` are raised by
 * `public.change_seat_status()` (not found, invalid transition, invalid
 * reason).
 */
export function mapSeatError(error: PostgrestError): SeatActionError {
  switch (error.code) {
    case "23505":
      return `${error.message} ${error.details ?? ""}`.includes("serial_number")
        ? DUPLICATE_SERIAL_ERROR
        : INTERNAL_ERROR;
    case "23514":
    case "23503":
    case "22023":
      return VALIDATION_ERROR;
    case "42501":
      return FORBIDDEN_ERROR;
    case "P0002":
      return NOT_FOUND_ERROR;
    case "55000":
      return INVALID_TRANSITION_ERROR;
    default:
      return INTERNAL_ERROR;
  }
}
