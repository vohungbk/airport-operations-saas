import type { PostgrestError } from "@supabase/supabase-js";

import { PHOTO_REQUIRED_MESSAGE } from "@/features/return-queue/schemas/complete-chain-step.schema";
import {
  RETURN_QUEUE_STEP_LABEL,
  type ReturnQueueStep,
} from "@/features/return-queue/lib/return-chain";

/** Stable error shape of the Complete step action. Raw Postgres errors never reach the client. */
export interface ChainStepActionError {
  code:
    | "VALIDATION_ERROR"
    | "PHOTO_REQUIRED"
    | "NOT_FOUND"
    | "OUT_OF_ORDER"
    | "SEAT_IN_QUARANTINE"
    | "BOOKING_CONFLICT"
    | "NETWORK_ERROR"
    | "INTERNAL_ERROR";
  message: string;
}

export type ChainStepActionResult =
  | { success: true }
  | { success: false; error: ChainStepActionError };

export const CHAIN_STEP_VALIDATION_ERROR: ChainStepActionError = {
  code: "VALIDATION_ERROR",
  message: "Check the form and try again.",
};

export const CHAIN_STEP_NETWORK_ERROR: ChainStepActionError = {
  code: "NETWORK_ERROR",
  message: "The step was not saved. Check your connection and try again.",
};

/** The database refused the step for a missing or misplaced photo (spec E5). */
export const CHAIN_STEP_PHOTO_REQUIRED_ERROR: ChainStepActionError = {
  code: "PHOTO_REQUIRED",
  message: PHOTO_REQUIRED_MESSAGE,
};

const DB_PHOTO_REQUIRED_MESSAGE = "A photo is required for this step";

const NOT_FOUND_ERROR: ChainStepActionError = {
  code: "NOT_FOUND",
  message: "This seat is no longer in the return queue.",
};

const QUARANTINE_ERROR: ChainStepActionError = {
  code: "SEAT_IN_QUARANTINE",
  message: "This seat is in quarantine. Its chain is stopped.",
};

/** A booking holds or uses the seat when the chain starts or completes (spec R10, FO-F03 R10). */
const BOOKING_CONFLICT_ERROR: ChainStepActionError = {
  code: "BOOKING_CONFLICT",
  message:
    "Another booking holds or uses the seat now or soon. Handle that booking first, then complete this step.",
};

const INTERNAL_ERROR: ChainStepActionError = {
  code: "INTERNAL_ERROR",
  message: "Something went wrong. Try again.",
};

/** The message for a step that is not the next one, naming the step the seat is at (E1, E4). */
function outOfOrderError(nextStep: string | undefined): ChainStepActionError {
  const label =
    nextStep && nextStep in RETURN_QUEUE_STEP_LABEL
      ? RETURN_QUEUE_STEP_LABEL[nextStep as ReturnQueueStep]
      : null;

  return {
    code: "OUT_OF_ORDER",
    message: label
      ? `This step is not the next one. The seat is at ${label}.`
      : "This step is not the next one in the chain.",
  };
}

/**
 * Maps an error of complete_return_chain_step() to the stable shape. Pure.
 * `42501` is not mapped here: the action shows the forbidden state for it (E9).
 */
export function mapChainStepError(
  error: Pick<PostgrestError, "code" | "details" | "message">,
): ChainStepActionError {
  switch (error.code) {
    case "P0002":
      return NOT_FOUND_ERROR;
    case "RC001":
    case "23505":
      return outOfOrderError(error.code === "RC001" ? error.details : undefined);
    case "55000":
      return QUARANTINE_ERROR;
    case "RC002":
      return BOOKING_CONFLICT_ERROR;
    case "22023":
      return error.message === DB_PHOTO_REQUIRED_MESSAGE
        ? CHAIN_STEP_PHOTO_REQUIRED_ERROR
        : CHAIN_STEP_VALIDATION_ERROR;
    default:
      return INTERNAL_ERROR;
  }
}
