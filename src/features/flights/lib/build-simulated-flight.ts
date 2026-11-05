import { diffFlight, type FlightChange, type StoredFlightValues } from "./flight-diff";
import type { FlightSnapshot } from "./provider/flight-source";

/** The flight as the simulator action reads it before the change. */
export interface SimulatorFlightRow extends StoredFlightValues {
  id: string;
  scheduled_arrival_at: string;
  last_synced_at: string | null;
  bookings: { id: string; created_at: string }[];
}

/**
 * VI-F02-S12: which flight a number means. A number can belong to several flights (other days, other airports),
 * so the one whose scheduled arrival is nearest to now is taken; the earlier one wins a tie. Pure.
 */
export function pickSimulatedFlight<T extends { scheduled_arrival_at: string }>(
  flights: readonly T[],
  now: Date,
): T | null {
  const distance = (flight: T) => Math.abs(Date.parse(flight.scheduled_arrival_at) - now.getTime());

  return (
    [...flights].sort(
      (a, b) =>
        distance(a) - distance(b) || Date.parse(a.scheduled_arrival_at) - Date.parse(b.scheduled_arrival_at),
    )[0] ?? null
  );
}

/** The booking the Flight status panel is opened on: the first one made on the flight. Null when there is none. */
export function pickBookingForFlight(bookings: readonly { id: string; created_at: string }[]): string | null {
  return [...bookings].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0]?.id ?? null;
}

export interface SimulatedChange {
  values: Pick<FlightSnapshot, "status" | "estimated_arrival_at" | "actual_arrival_at" | "terminal" | "delay_minutes"> & {
    provider: "simulator";
  };
  changes: FlightChange[];
}

/**
 * VI-F02-S12 (R4): the values a simulated change stores, worked out the way the provider data is: the delay is
 * the estimate against the schedule in minutes (negative when early), a landed flight has its actual arrival at
 * the estimate, and the terminal is kept. The changes are the diff the history keeps. Pure.
 */
export function buildSimulatedChange(
  flight: StoredFlightValues & { scheduled_arrival_at: string },
  input: { estimated_arrival_at: string; status: FlightSnapshot["status"] },
): SimulatedChange {
  const delay_minutes = Math.round(
    (Date.parse(input.estimated_arrival_at) - Date.parse(flight.scheduled_arrival_at)) / 60_000,
  );

  const values = {
    status: input.status,
    estimated_arrival_at: input.estimated_arrival_at,
    actual_arrival_at: input.status === "landed" ? input.estimated_arrival_at : null,
    terminal: flight.terminal,
    delay_minutes,
    provider: "simulator" as const,
  };

  return { values, changes: diffFlight(flight, values) };
}
