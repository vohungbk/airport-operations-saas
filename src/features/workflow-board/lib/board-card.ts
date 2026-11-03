import { formatTimeInStep } from "@/features/bookings/lib/booking-step-history";
import { classifyFlight, getFlightOffsetMinutes, type FlightTimes } from "@/lib/flights/flight-timing";

/**
 * What a card of the Workflow Board says, worked out from the values the board reads (CO-F08-T01,
 * AC03, AC04). Pure, no I/O.
 */

export interface FlightAlertMark {
  kind: "early" | "delayed";
  /** Always positive. */
  minutes: number;
  /** "Early 45 min" or "Delayed 50 min". */
  label: string;
}

/** The mark of a flight that is early or delayed past the alert threshold; `null` otherwise or with no flight. */
export function buildFlightAlertMark(flight: FlightTimes | null): FlightAlertMark | null {
  if (!flight) return null;

  const offset = getFlightOffsetMinutes(flight);
  const timing = classifyFlight(offset);
  if ((timing !== "early" && timing !== "delayed") || offset === null) return null;

  const minutes = Math.abs(offset);
  return { kind: timing, minutes, label: `${timing === "early" ? "Early" : "Delayed"} ${minutes} min` };
}

/** "In step 2 h 10 min"; `null` when no event says when the step began. */
export function buildTimeInStepLabel(stepSince: string | null, now: Date): string | null {
  if (!stepSince) return null;

  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(stepSince).getTime()) / 60_000));
  return `In step ${formatTimeInStep(minutes)}`;
}
