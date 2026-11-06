import type { PostgrestError } from "@supabase/supabase-js";

/**
 * VI-F02-S07: the error shape of the manual arrival action, stable and machine-readable. A raw database
 * error never reaches the client.
 */
export interface ManualArrivalError {
  code:
    | "VALIDATION_ERROR"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "BOOKING_ENDED"
    | "NO_FLIGHT_NUMBER"
    | "NO_CHANGE"
    | "STALE_DATA"
    | "NETWORK_ERROR"
    | "INTERNAL_ERROR";
  message: string;
  /** For `VALIDATION_ERROR`: the message of each field that failed, so the form can show it under the field. */
  details?: { field: string; issue: string }[];
}

export interface ManualArrivalResult {
  success: boolean;
  error?: ManualArrivalError;
}

export const VALIDATION_ERROR: ManualArrivalError = {
  code: "VALIDATION_ERROR",
  message: "Check the form and try again.",
};

export const FORBIDDEN_ERROR: ManualArrivalError = {
  code: "FORBIDDEN",
  message: "You do not have permission to do this.",
};

export const NOT_FOUND_ERROR: ManualArrivalError = {
  code: "NOT_FOUND",
  message: "This booking was not found.",
};

export const BOOKING_ENDED_ERROR: ManualArrivalError = {
  code: "BOOKING_ENDED",
  message: "This booking has ended. An arrival can be entered only for an open booking.",
};

export const NO_FLIGHT_NUMBER_ERROR: ManualArrivalError = {
  code: "NO_FLIGHT_NUMBER",
  message: "This booking has no flight number.",
};

export const NO_CHANGE_ERROR: ManualArrivalError = {
  code: "NO_CHANGE",
  message: "This is the arrival already stored. Enter a different time.",
};

export const STALE_DATA_ERROR: ManualArrivalError = {
  code: "STALE_DATA",
  message: "This flight was updated by someone else. Check the flight and enter the arrival again.",
};

export const NETWORK_ERROR: ManualArrivalError = {
  code: "NETWORK_ERROR",
  message: "Could not reach the server. Your input is kept; check your connection and try again.",
};

export const INTERNAL_ERROR: ManualArrivalError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again.",
};

/** `42501` is the role check of the database function, `P0002` a missing row; the rest is not the user's to see. */
export function mapManualArrivalError(error: PostgrestError): ManualArrivalError {
  if (error.code === "42501") return FORBIDDEN_ERROR;
  if (error.code === "P0002") return NOT_FOUND_ERROR;
  if (error.code === "22023") {
    if (/ended/i.test(error.message)) return BOOKING_ENDED_ERROR;
    if (/no flight number/i.test(error.message)) return NO_FLIGHT_NUMBER_ERROR;
    if (/nothing changed/i.test(error.message)) return NO_CHANGE_ERROR;
    return VALIDATION_ERROR;
  }

  return INTERNAL_ERROR;
}
