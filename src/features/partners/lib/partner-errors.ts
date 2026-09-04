import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Stable, machine-readable error shape shared by every partners Server
 * Action, matching `backend.md`'s `{ code, message }` convention. Never
 * a raw Postgres/Supabase error reaches the client — see `mapPartnerError`.
 */
export interface PartnerActionError {
  code:
    | "VALIDATION_ERROR"
    | "DUPLICATE_CODE"
    | "NOT_FOUND"
    | "CONFLICT"
    | "INTERNAL_ERROR";
  message: string;
}

export const VALIDATION_ERROR: PartnerActionError = {
  code: "VALIDATION_ERROR",
  message: "Check the form and try again.",
};

export const DUPLICATE_CODE_ERROR: PartnerActionError = {
  code: "DUPLICATE_CODE",
  message: "A partner with this code already exists.",
};

export const NOT_FOUND_ERROR: PartnerActionError = {
  code: "NOT_FOUND",
  message: "Partner not found.",
};

export const ALREADY_INACTIVE_ERROR: PartnerActionError = {
  code: "CONFLICT",
  message: "This partner is already inactive.",
};

export const INTERNAL_ERROR: PartnerActionError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again.",
};

/**
 * Maps a Postgres error surfaced by a partners insert/update to a stable
 * `{ code, message }` pair. `23505` is `partners_code_key`'s unique
 * violation (the only unique constraint on this table) — every other
 * Postgres error is folded into a generic `INTERNAL_ERROR` rather than
 * leaking raw DB error text to the client.
 */
export function mapPartnerError(error: PostgrestError): PartnerActionError {
  if (error.code === "23505") {
    return DUPLICATE_CODE_ERROR;
  }

  return INTERNAL_ERROR;
}
