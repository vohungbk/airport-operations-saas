import type { PostgrestError } from "@supabase/supabase-js";

/**
 * The stable error of the baseline inputs action, as in `backend.md`: a code to branch on and a message.
 * A raw database error never reaches the client.
 */
export interface BaselineInputsActionError {
  code: "VALIDATION_ERROR" | "NETWORK_ERROR" | "INTERNAL_ERROR";
  message: string;
}

export const VALIDATION_ERROR: BaselineInputsActionError = {
  code: "VALIDATION_ERROR",
  message: "Check the form and try again.",
};

export const NETWORK_ERROR: BaselineInputsActionError = {
  code: "NETWORK_ERROR",
  message: "Could not reach the server. Your entries are kept: try again.",
};

export const INTERNAL_ERROR: BaselineInputsActionError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again.",
};

/**
 * The error codes of `save_partner_baseline_inputs()`. Anything else is a generic error. `42501` (forbidden)
 * is not mapped here: the action ends in the forbidden state instead.
 */
export function mapBaselineInputsError(error: Pick<PostgrestError, "code">): BaselineInputsActionError {
  switch (error.code) {
    case "22023":
      return { code: "VALIDATION_ERROR", message: "Every field is required." };
    case "BL001":
      return { code: "VALIDATION_ERROR", message: "An amount must be zero or more, with at most 2 decimals." };
    case "BL002":
      return { code: "VALIDATION_ERROR", message: "A count must be a whole number of zero or more." };
    case "BL003":
      return { code: "VALIDATION_ERROR", message: "A conversion must be from 0 to 100, with at most 2 decimals." };
    default:
      return INTERNAL_ERROR;
  }
}
