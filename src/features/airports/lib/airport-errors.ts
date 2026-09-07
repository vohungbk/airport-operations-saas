import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Stable, machine-readable error shape shared by every airports Server
 * Action, matching `backend.md`'s `{ code, message }` convention. Never
 * a raw Postgres/Supabase error reaches the client — see `mapAirportError`.
 * No `CONFLICT`/`ALREADY_INACTIVE` — there is no deactivate action in
 * F07's scope (plan.md's "Quyết định đã chốt" #3).
 */
export interface AirportActionError {
  code: "VALIDATION_ERROR" | "DUPLICATE_CODE" | "NOT_FOUND" | "INTERNAL_ERROR";
  message: string;
}

export const VALIDATION_ERROR: AirportActionError = {
  code: "VALIDATION_ERROR",
  message: "Check the form and try again.",
};

export const DUPLICATE_CODE_ERROR: AirportActionError = {
  code: "DUPLICATE_CODE",
  message: "An airport with this code already exists.",
};

export const NOT_FOUND_ERROR: AirportActionError = {
  code: "NOT_FOUND",
  message: "Airport not found.",
};

export const INTERNAL_ERROR: AirportActionError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again.",
};

/**
 * Maps a Postgres error surfaced by an airports insert/update to a
 * stable `{ code, message }` pair. `23505` is `airports_code_key`'s
 * unique violation (the only unique constraint on this table) — every
 * other Postgres error is folded into a generic `INTERNAL_ERROR` rather
 * than leaking raw DB error text to the client.
 */
export function mapAirportError(error: PostgrestError): AirportActionError {
  if (error.code === "23505") {
    return DUPLICATE_CODE_ERROR;
  }

  return INTERNAL_ERROR;
}
