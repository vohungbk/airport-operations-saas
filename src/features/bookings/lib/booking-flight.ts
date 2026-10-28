import { getFlightOffsetMinutes } from "@/lib/flights/flight-timing";
import type { BookingFlight } from "@/features/bookings/lib/get-bookings";

/**
 * The flight of a booking as one line for the list: its number and how early or late it is, for example
 * `EK 203 · −45m`. Nothing is made up: a booking with no flight gives "-", and a flight whose time offset
 * is unknown gives its number alone.
 */
export function formatBookingFlight(
  flight: Pick<
    BookingFlight,
    | "flight_number"
    | "scheduled_arrival_at"
    | "estimated_arrival_at"
    | "actual_arrival_at"
    | "delay_minutes"
  > | null,
): string {
  if (!flight) return "-";

  const offset = getFlightOffsetMinutes(flight);

  if (offset === null) return flight.flight_number;
  if (offset === 0) return `${flight.flight_number} · on time`;

  return `${flight.flight_number} · ${offset > 0 ? "+" : "−"}${Math.abs(offset)}m`;
}
