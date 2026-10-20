import type { SeatStatus } from "@/features/seats/types";

export interface IncidentSeatRef {
  serial_number: string;
  status: SeatStatus;
}

/**
 * The serial number of the seat an incident refers to. A seat is never
 * deleted, only retired, so the reference stays and says so.
 */
export function formatIncidentSeat(
  seat: IncidentSeatRef | null,
): string | null {
  if (!seat) {
    return null;
  }

  return seat.status === "retired"
    ? `${seat.serial_number} (Retired)`
    : seat.serial_number;
}
