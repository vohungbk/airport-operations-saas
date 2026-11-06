import { formatTimeInStep } from "@/features/bookings/lib/booking-step-history";
import { classifyFlight, getFlightDisruption, getFlightOffsetMinutes, type FlightDisruption, type FlightTimes } from "@/lib/flights/flight-timing";

/**
 * What a card of the Workflow Board says, worked out from the values the board reads (CO-F08-T01,
 * AC03, AC04). Pure, no I/O.
 */

export interface FlightAlertMark {
  kind: "early" | "delayed" | FlightDisruption;
  /** Always positive; 0 for a cancelled or diverted flight. */
  minutes: number;
  /** "Early 45 min", "Delayed 50 min", "Flight cancelled" or "Flight diverted". */
  label: string;
}

/** The mark of a flight that is cancelled, diverted, or early or delayed past the alert threshold; `null` otherwise or with no flight. */
export function buildFlightAlertMark(flight: (FlightTimes & { status?: string }) | null): FlightAlertMark | null {
  if (!flight) return null;

  // Cancelled or diverted (VI-F02-S06): the status flags the booking; an old estimate is not read.
  const disruption = getFlightDisruption(flight.status);
  if (disruption) return { kind: disruption, minutes: 0, label: `Flight ${disruption}` };

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
