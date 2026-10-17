import type { SeatStatus } from "@/features/seats/types";

/**
 * Seat statuses an installation can be recorded for. Must stay in sync with
 * `public.guard_installation_insert()` (`JB007`), which is the enforcing
 * authority; this only lets the screen say so before the user fills the form.
 */
export const INSTALLABLE_SEAT_STATUSES = [
  "available",
  "reserved",
] as const satisfies readonly SeatStatus[];

export function isSeatEligibleForInstallation(status: SeatStatus): boolean {
  return (INSTALLABLE_SEAT_STATUSES as readonly SeatStatus[]).includes(status);
}
