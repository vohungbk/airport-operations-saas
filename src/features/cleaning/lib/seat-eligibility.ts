import type { SeatStatus } from "@/features/seats/types";

/**
 * A seat can be cleaned in any status except `retired`, which is terminal.
 * Must stay in sync with `public.guard_cleaning_insert()` (`JB007`), which is
 * the enforcing authority; this only lets the screen say so before the user
 * fills the form.
 */
export function isSeatEligibleForCleaning(status: SeatStatus): boolean {
  return status !== "retired";
}
