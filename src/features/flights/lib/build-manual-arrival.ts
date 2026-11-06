import { diffFlight, type FlightChange, type StoredFlightValues } from "./flight-diff";
import type { FlightSnapshot } from "./provider/flight-source";

/** What a flight that does not exist yet holds before the first manual entry. */
const NEW_FLIGHT: StoredFlightValues = {
  status: "scheduled",
  estimated_arrival_at: null,
  actual_arrival_at: null,
  terminal: null,
  delay_minutes: null,
};

export interface ManualArrivalChange {
  values: Pick<FlightSnapshot, "status" | "estimated_arrival_at" | "actual_arrival_at" | "terminal" | "delay_minutes"> & {
    provider: "manual";
  };
  changes: FlightChange[];
}

/**
 * VI-F02-S07 (Q4): the values a manual entry stores. The arrival entered is the estimated arrival; the delay
 * is that time against the schedule in minutes (negative when early), as for provider and simulator data. The
 * status, the actual arrival and the terminal are kept. A new flight (the provider did not know the number)
 * starts from a scheduled flight with nothing else. The changes are the diff the history keeps. Pure.
 */
export function buildManualArrival(
  flight: StoredFlightValues | null,
  scheduled_arrival_at: string,
  arrival_at: string,
): ManualArrivalChange {
  const stored = flight ?? NEW_FLIGHT;
  const values = {
    status: stored.status,
    estimated_arrival_at: arrival_at,
    actual_arrival_at: stored.actual_arrival_at,
    terminal: stored.terminal,
    delay_minutes: Math.round((Date.parse(arrival_at) - Date.parse(scheduled_arrival_at)) / 60_000),
    provider: "manual" as const,
  };

  return { values, changes: diffFlight(stored, values) };
}
