/**
 * The one place that turns the counts of the additional KPI functions (VI-F05-S02) into a figure. Pure,
 * no I/O. A figure is never 0 when there is nothing to count ("No data") or nothing stored to measure
 * ("Not available"): the screen words both, and neither is a number (spec R13, E1, E4).
 */

export type MeasureFigure =
  | { state: "value"; value: number }
  | { state: "no_data" }
  | { state: "not_available"; reason: string };

export type InventoryFigure = { state: "value"; seats: number; airports: string } | { state: "no_data" };

export type ReplacementFigure =
  | { state: "value"; percent: number; replacements: number; rentals: number }
  | { state: "no_data" };

export type RefundsFigure =
  | { state: "value"; amount: number; refunded_bookings: number }
  | { state: "no_data" };

/** Only the notice of the figure: the reason the screen shows when nothing is stored. */
export type NotAvailableFigure = { state: "not_available"; reason: string };

export const NO_UTILISATION_INPUT = "No seat is in service in this period";
export const NO_INSTALLATION_TIME_INPUT = "No installation start time is stored for these bookings";
export const NO_PREPARATION_TIME_INPUT = "No preparation start is stored for these bookings";
export const COMPLAINTS_MISSING_INPUT = "No complaint record exists yet";

const roundOneDecimal = (value: number) => Math.round(value * 10) / 10;

export interface BookingCounts {
  completed_bookings: number;
  paid_days: number;
  rented_days: number;
  replacements: number;
  refund_amount: number;
  refunded_bookings: number;
  installation_jobs: number;
  installation_timed: number;
  installation_minutes: number;
  prepared_bookings: number;
  preparation_timed: number;
  preparation_minutes: number;
}

export interface InventoryCounts {
  seats_in_service: number;
  available_seats: number;
  available_seat_days: number;
  airport_codes: string;
}

/** Rented seat-days over available seat-days, in percent. */
export function seatUtilisationFigure(
  booking: Pick<BookingCounts, "completed_bookings" | "rented_days">,
  inventory: Pick<InventoryCounts, "available_seat_days">,
): MeasureFigure {
  if (booking.completed_bookings === 0) return { state: "no_data" };
  if (inventory.available_seat_days <= 0) return { state: "not_available", reason: NO_UTILISATION_INPUT };

  return { state: "value", value: roundOneDecimal((booking.rented_days / inventory.available_seat_days) * 100) };
}

/** Paid days over completed rentals, in days. */
export function averageRentalDurationFigure(counts: Pick<BookingCounts, "completed_bookings" | "paid_days">): MeasureFigure {
  if (counts.completed_bookings === 0) return { state: "no_data" };

  return { state: "value", value: roundOneDecimal(counts.paid_days / counts.completed_bookings) };
}

/** The seats available now, and the airports they are at. */
export function inventoryBufferFigure(counts: Pick<InventoryCounts, "seats_in_service" | "available_seats" | "airport_codes">): InventoryFigure {
  if (counts.seats_in_service === 0) return { state: "no_data" };

  return { state: "value", seats: counts.available_seats, airports: counts.airport_codes };
}

/** Seat replacements over completed rentals, in percent. */
export function replacementRateFigure(counts: Pick<BookingCounts, "completed_bookings" | "replacements">): ReplacementFigure {
  if (counts.completed_bookings === 0) return { state: "no_data" };

  return {
    state: "value",
    percent: roundOneDecimal((counts.replacements / counts.completed_bookings) * 100),
    replacements: counts.replacements,
    rentals: counts.completed_bookings,
  };
}

/** Minutes from the start of the preparation to Ready; a booking without a start is left out of the average. */
export function averagePreparationFigure(counts: Pick<BookingCounts, "prepared_bookings" | "preparation_timed" | "preparation_minutes">): MeasureFigure {
  if (counts.prepared_bookings === 0) return { state: "no_data" };
  if (counts.preparation_timed === 0) return { state: "not_available", reason: NO_PREPARATION_TIME_INPUT };

  return { state: "value", value: counts.preparation_minutes / counts.preparation_timed };
}

/** Minutes from the start of an installation to its completion; a job without a start is left out of the average. */
export function installationTimeFigure(counts: Pick<BookingCounts, "installation_jobs" | "installation_timed" | "installation_minutes">): MeasureFigure {
  if (counts.installation_jobs === 0) return { state: "no_data" };
  if (counts.installation_timed === 0) return { state: "not_available", reason: NO_INSTALLATION_TIME_INPUT };

  return { state: "value", value: counts.installation_minutes / counts.installation_timed };
}

/** Refunds of the completed bookings, in USD. No completed booking is no data; completed bookings with no refund are a real 0. */
export function refundsFigure(counts: Pick<BookingCounts, "completed_bookings" | "refund_amount" | "refunded_bookings">): RefundsFigure {
  if (counts.completed_bookings === 0) return { state: "no_data" };

  return { state: "value", amount: counts.refund_amount, refunded_bookings: counts.refunded_bookings };
}

/** No complaint record exists in the platform (spec Q3), so the figure is never a number. */
export function complaintsFigure(): NotAvailableFigure {
  return { state: "not_available", reason: COMPLAINTS_MISSING_INPUT };
}
