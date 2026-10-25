import type { PostgrestError } from "@supabase/supabase-js";

/**
 * The stable error of the generate Server Action, as in `backend.md`: a code to branch on and a
 * message. A raw database error never reaches the client.
 */
export interface SettlementActionError {
  code: "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "NETWORK_ERROR" | "INTERNAL_ERROR";
  message: string;
  /** The field the message belongs to, when there is one. */
  field?: "partner_id" | "month";
}

export interface SettlementActionResult {
  success: boolean;
  error?: SettlementActionError;
}

export const VALIDATION_ERROR: SettlementActionError = {
  code: "VALIDATION_ERROR",
  message: "Check the form and try again.",
};

export const FORBIDDEN_ERROR: SettlementActionError = {
  code: "FORBIDDEN",
  message: "You cannot generate a settlement.",
};

export const NETWORK_ERROR: SettlementActionError = {
  code: "NETWORK_ERROR",
  message: "Could not reach the server. Your entries are kept: try again.",
};

export const INTERNAL_ERROR: SettlementActionError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again.",
};

/** The error codes of `generate_monthly_settlement()`. Anything else is a generic error. */
export function mapSettlementError(error: Pick<PostgrestError, "code">): SettlementActionError {
  switch (error.code) {
    case "42501":
      return FORBIDDEN_ERROR;
    case "P0002":
      return {
        code: "NOT_FOUND",
        message: "Partner not found.",
        field: "partner_id",
      };
    case "ST002":
      return {
        code: "VALIDATION_ERROR",
        message: "The month cannot be in the future.",
        field: "month",
      };
    case "ST003":
      return {
        code: "CONFLICT",
        message: "This partner already has a settlement for this month.",
        field: "month",
      };
    case "ST004":
      return {
        code: "CONFLICT",
        message: "This partner has no completed rental in this month.",
        field: "month",
      };
    case "22023":
      return VALIDATION_ERROR;
    default:
      return INTERNAL_ERROR;
  }
}

/** The error codes of `move_settlement_status()`. Anything else is a generic error. */
export function mapMoveSettlementError(error: Pick<PostgrestError, "code">): SettlementActionError {
  switch (error.code) {
    case "42501":
      return FORBIDDEN_ERROR;
    case "P0002":
      return { code: "NOT_FOUND", message: "Settlement not found." };
    case "ST006":
      return {
        code: "CONFLICT",
        message: "This settlement cannot move to that status. Reload the page and try again.",
      };
    case "22023":
      return VALIDATION_ERROR;
    default:
      return INTERNAL_ERROR;
  }
}
