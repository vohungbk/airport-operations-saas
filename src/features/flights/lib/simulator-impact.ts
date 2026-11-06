import { zonedLocalToUtcIso } from "@/features/bookings/lib/booking-time";
import { getFlightChange, getFlightPriority } from "@/features/flights/lib/flight-board";
import { BASE_DEADLINE_MINUTES, formatClock } from "@/features/flights/lib/flight-panel";
import { ALERT_THRESHOLD_MINUTES } from "@/lib/flights/flight-timing";

/** The first booking on the flight: the booking the Flight tab opens on, and the one the impact is worked out for. */
export interface SimulatorBooking {
  pickup_at: string;
  /** The deadline now stored on its open installation job; null when it has none. */
  installation_deadline_at: string | null;
}

/** The flight a number means, with what the impact is worked out from (read on the server, RLS applies). */
export interface SimulatorFlightPreview {
  flight_number: string;
  airport_code: string;
  airport_name: string;
  time_zone: string;
  scheduled_arrival_at: string;
  booking: SimulatorBooking | null;
}

/** What the impact card shows: a dash for anything that cannot be worked out yet. Nothing is made up. */
export interface SimulatorImpact {
  change: string;
  priority: "High" | "Normal" | "-";
  new_deadline: string;
  previous_deadline: string;
}

export const NO_VALUE = "-";

const MINUTE_MS = 60_000;

const EMPTY_IMPACT: SimulatorImpact = {
  change: NO_VALUE,
  priority: NO_VALUE,
  new_deadline: NO_VALUE,
  previous_deadline: NO_VALUE,
};

/**
 * VI-F02-T02 (Figma D7): the operational impact of a simulated change, worked out before it is applied, with the
 * rules of VI-F02: early or late by 15 minutes or more moves the installation deadline by the same minutes, from the
 * base deadline of 60 minutes before the pickup; the priority is High only for an early flight (Q5). The change and
 * the priority are read the way the Flight board reads them. The previous deadline is the one stored now. The
 * estimated arrival is wall-clock time at the airport. Pure.
 */
export function buildSimulatorImpact(input: {
  preview: SimulatorFlightPreview | null;
  estimated_arrival_at: string;
  status: string;
}): SimulatorImpact {
  const { preview } = input;

  if (!preview) return EMPTY_IMPACT;

  const previous_deadline = preview.booking?.installation_deadline_at
    ? formatClock(preview.booking.installation_deadline_at, preview.time_zone)
    : NO_VALUE;
  const estimatedIso = zonedLocalToUtcIso(input.estimated_arrival_at, preview.time_zone);

  if (!estimatedIso) return { ...EMPTY_IMPACT, previous_deadline };

  const change = getFlightChange({
    status: input.status,
    scheduled_arrival_at: preview.scheduled_arrival_at,
    estimated_arrival_at: estimatedIso,
    actual_arrival_at: null,
    delay_minutes: null,
  });
  const offset = Math.round((Date.parse(estimatedIso) - Date.parse(preview.scheduled_arrival_at)) / MINUTE_MS);
  const moved = Math.abs(offset) >= ALERT_THRESHOLD_MINUTES ? offset : 0;

  return {
    change: change.label,
    priority: getFlightPriority(change) === "high" ? "High" : "Normal",
    new_deadline: preview.booking
      ? formatClock(
          new Date(Date.parse(preview.booking.pickup_at) + (moved - BASE_DEADLINE_MINUTES) * MINUTE_MS).toISOString(),
          preview.time_zone,
        )
      : NO_VALUE,
    previous_deadline,
  };
}
