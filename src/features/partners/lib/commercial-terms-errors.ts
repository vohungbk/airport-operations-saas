import type { PostgrestError } from "@supabase/supabase-js";

/**
 * The stable error of the commercial terms actions, as in `backend.md`: a code to branch on and
 * a message. A raw database error never reaches the client.
 */
export interface CommercialTermsActionError {
  code: "VALIDATION_ERROR" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR";
  message: string;
  /** The field the message belongs to, when there is one. */
  field?: "partner_share_percent" | "launch_partner_share_percent" | "effective_from";
}

export const VALIDATION_ERROR: CommercialTermsActionError = {
  code: "VALIDATION_ERROR",
  message: "Check the form and try again.",
};

export const FORBIDDEN_ERROR: CommercialTermsActionError = {
  code: "FORBIDDEN",
  message: "Only an admin can change commercial terms.",
};

export const NOT_FOUND_ERROR: CommercialTermsActionError = {
  code: "NOT_FOUND",
  message: "Partner not found.",
};

export const INTERNAL_ERROR: CommercialTermsActionError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again.",
};

/** The error codes of `set_partner_commercial_terms()`. Anything else is a generic error. */
export function mapCommercialTermsError(error: Pick<PostgrestError, "code">): CommercialTermsActionError {
  switch (error.code) {
    case "42501":
      return FORBIDDEN_ERROR;
    case "P0002":
      return NOT_FOUND_ERROR;
    case "TC001":
      return {
        code: "VALIDATION_ERROR",
        message: "The partner share must be from 0 to 100 with at most 2 decimals.",
        field: "partner_share_percent",
      };
    case "TC002":
      return {
        code: "VALIDATION_ERROR",
        message: "The launch partner share must be from 0 to 100 and not below the partner share.",
        field: "launch_partner_share_percent",
      };
    case "TC003":
      return {
        code: "VALIDATION_ERROR",
        message: "The effective date cannot be in the past.",
        field: "effective_from",
      };
    case "TC004":
      return {
        code: "CONFLICT",
        message: "The effective date must be after the start of the latest terms. Choose a later date.",
        field: "effective_from",
      };
    default:
      return INTERNAL_ERROR;
  }
}
