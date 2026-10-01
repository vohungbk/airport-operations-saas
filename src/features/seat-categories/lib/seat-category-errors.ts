import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Stable, machine-readable error shape shared by every seat-category
 * Server Action. Raw Postgres errors never reach the client.
 */
export interface SeatCategoryActionError {
  code:
    | "VALIDATION_ERROR"
    | "DUPLICATE_NAME"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "INTERNAL_ERROR";
  message: string;
}

export const VALIDATION_ERROR: SeatCategoryActionError = {
  code: "VALIDATION_ERROR",
  message: "Check the form and try again.",
};

export const DUPLICATE_NAME_ERROR: SeatCategoryActionError = {
  code: "DUPLICATE_NAME",
  message: "A seat category with this name already exists.",
};

export const FORBIDDEN_ERROR: SeatCategoryActionError = {
  code: "FORBIDDEN",
  message: "You do not have permission to do this.",
};

export const NOT_FOUND_ERROR: SeatCategoryActionError = {
  code: "NOT_FOUND",
  message: "Seat category not found.",
};

export const INTERNAL_ERROR: SeatCategoryActionError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Please try again.",
};

/**
 * `23514` is the age-range CHECK, `42501` is an RLS denial; everything
 * else folds into a generic `INTERNAL_ERROR`.
 */
export function mapSeatCategoryError(
  error: PostgrestError,
): SeatCategoryActionError {
  if (error.code === "23514") {
    return VALIDATION_ERROR;
  }

  if (error.code === "42501") {
    return FORBIDDEN_ERROR;
  }

  return INTERNAL_ERROR;
}
