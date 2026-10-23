import type { SeatStatus } from "@/features/seats/types";

/**
 * A cleaning can be started only on an `available` seat. Must stay in sync
 * with `public.start_cleaning()` (`JB008`), which is the enforcing authority;
 * this only lets the screen say so before the user presses Start. The other
 * reason a start is refused, a booking that holds or uses the seat in the
 * cleaning period (`JB009`), is shown from the error, so the rule lives in one
 * place.
 */
export function canStartCleaningOnSeat(status: SeatStatus): boolean {
  return status === "available";
}
