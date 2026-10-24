import type { PostgrestError } from "@supabase/supabase-js";

/**
 * The stable error of the adjustment Server Action, as in `backend.md`: a code to branch on and a
 * message. A raw database error never reaches the client.
 */
export interface AdjustmentActionError {
  code: "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "NETWORK_ERROR" | "INTERNAL_ERROR";
  message: string;
  /** The field the message belongs to, when there is one. */
  field?: "type" | "amount" | "reason";
}

export interface AdjustmentActionResult {
  success: boolean;
  error?: AdjustmentActionError;
}

export const VALIDATION_ERROR: AdjustmentActionError = {
  code: "VALIDATION_ERROR",
  message: "Check the form and try again.",
};

export const NOT_FOUND_ERROR: AdjustmentActionError = {
  code: "NOT_FOUND",
  message: "Booking not found.",
};

export const NOT_ADJUSTABLE_ERROR: AdjustmentActionError = {
  code: "CONFLICT",
  message: "This booking has no revenue to adjust.",
};

export const FORBIDDEN_ERROR: AdjustmentActionError = {
  code: "FORBIDDEN",
  message: "You cannot add an adjustment.",
};

export const NETWORK_ERROR: AdjustmentActionError = {
  code: "NETWORK_ERROR",
  message: "Could not reach the server. Your entries are kept: try again.",
};

export const INTERNAL_ERROR: AdjustmentActionError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again.",
};

/** The error codes of `add_booking_adjustment()`. Anything else is a generic error. */
export function mapAdjustmentError(error: Pick<PostgrestError, "code">): AdjustmentActionError {
  switch (error.code) {
    case "42501":
      return FORBIDDEN_ERROR;
    case "P0002":
      return NOT_FOUND_ERROR;
    case "BA004":
      return NOT_ADJUSTABLE_ERROR;
    case "BA002":
      return {
        code: "VALIDATION_ERROR",
        message: "The amount must be above zero with at most 2 decimals.",
        field: "amount",
      };
    case "BA003":
      return {
        code: "VALIDATION_ERROR",
        message: "The amount cannot be above the gross revenue the booking has now.",
        field: "amount",
      };
    case "BA005":
      return {
        code: "VALIDATION_ERROR",
        message: "Enter the reason, with at most 1000 characters.",
        field: "reason",
      };
    case "22P02":
      return { code: "VALIDATION_ERROR", message: "Choose the type of adjustment.", field: "type" };
    case "22023":
      return VALIDATION_ERROR;
    default:
      return INTERNAL_ERROR;
  }
}
