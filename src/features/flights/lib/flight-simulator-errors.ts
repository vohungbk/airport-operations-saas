import type { PostgrestError } from "@supabase/supabase-js";

/**
 * VI-F02-S12: the error shape of the Flight simulator action, stable and machine-readable. A raw database
 * error never reaches the client.
 */
export interface FlightSimulatorError {
  code:
    | "VALIDATION_ERROR"
    | "FORBIDDEN"
    | "SOURCE_NOT_SIMULATOR"
    | "FLIGHT_NOT_FOUND"
    | "STALE_DATA"
    | "NETWORK_ERROR"
    | "INTERNAL_ERROR";
  message: string;
  /** For `VALIDATION_ERROR`: the message of each field that failed, so the form can show it under the field. */
  details?: { field: string; issue: string }[];
}

export interface FlightSimulatorResult {
  success: boolean;
  error?: FlightSimulatorError;
}

export const VALIDATION_ERROR: FlightSimulatorError = {
  code: "VALIDATION_ERROR",
  message: "Check the form and try again.",
};

export const FORBIDDEN_ERROR: FlightSimulatorError = {
  code: "FORBIDDEN",
  message: "You do not have permission to do this.",
};

export const SOURCE_NOT_SIMULATOR_ERROR: FlightSimulatorError = {
  code: "SOURCE_NOT_SIMULATOR",
  message: "The flight simulator is available only when the active flight source is the simulator.",
};

export const FLIGHT_NOT_FOUND_ERROR: FlightSimulatorError = {
  code: "FLIGHT_NOT_FOUND",
  message: "No open booking has a flight with this number. Check the flight number and try again.",
};

export const STALE_DATA_ERROR: FlightSimulatorError = {
  code: "STALE_DATA",
  message: "This flight was changed by someone else. Apply the change again.",
};

export const NETWORK_ERROR: FlightSimulatorError = {
  code: "NETWORK_ERROR",
  message: "Could not reach the server. Your input is kept; check your connection and try again.",
};

export const INTERNAL_ERROR: FlightSimulatorError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again.",
};

/** `42501` is the role check of the database function; everything else is not the user's to see. */
export function mapSimulatorError(error: PostgrestError): FlightSimulatorError {
  return error.code === "42501" ? FORBIDDEN_ERROR : INTERNAL_ERROR;
}
