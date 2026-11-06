/**
 * The one place that turns the counts of the KPI functions (VI-F05-T02) into a figure. The screens, the
 * export and the assistant all read it, so a figure is worded and rounded once. Pure, no I/O.
 *
 * A rate is never shown as 0% when there is nothing to count ("No data") or nothing stored to compare
 * ("Not available"). A row whose input is not stored is left out of the rate: it is not a failure.
 */

export type KpiFigure =
  | {
      state: "value";
      /** A percentage, 0 to 100, rounded to one decimal. */
      percent: number;
      numerator: number;
      denominator: number;
      /** Rows left out because their input is not stored. */
      excluded: number;
    }
  | { state: "no_data" }
  | { state: "not_available"; reason: string };

export interface RateCounts {
  /** Every row of the period. */
  total: number;
  /** The rows whose input is stored; only these are in the rate. */
  with_input: number;
  /** The rows that meet the rule. */
  matched: number;
}

export const NO_DATA_TEXT = "No data";
export const NOT_AVAILABLE_TEXT = "Not available";

const roundOneDecimal = (value: number) => Math.round(value * 10) / 10;

/** The rate of `matched` over `with_input`. `missing_input` is the short reason when no row has its input. */
export function rateFigure(counts: RateCounts, missing_input: string): KpiFigure {
  if (counts.total === 0) return { state: "no_data" };
  if (counts.with_input === 0) return { state: "not_available", reason: missing_input };

  return {
    state: "value",
    percent: roundOneDecimal((counts.matched / counts.with_input) * 100),
    numerator: counts.matched,
    denominator: counts.with_input,
    excluded: counts.total - counts.with_input,
  };
}

/** "90%", "97.5%", "No data" or "Not available". */
export function formatKpiFigure(figure: KpiFigure): string {
  switch (figure.state) {
    case "value":
      return `${figure.percent}%`;
    case "no_data":
      return NO_DATA_TEXT;
    case "not_available":
      return NOT_AVAILABLE_TEXT;
  }
}

export const CORRECT_SEAT_MISSING_INPUT = "No seat scan result is stored for these bookings";
export const ON_TIME_READINESS_MISSING_INPUT = "No deadline is stored for these bookings";

/** Correct-seat fulfilment: completed bookings with the allocated seat installed, over completed bookings. */
export function correctSeatFigure(counts: { completed_bookings: number; with_result: number; matched: number }): KpiFigure {
  return rateFigure(
    { total: counts.completed_bookings, with_input: counts.with_result, matched: counts.matched },
    CORRECT_SEAT_MISSING_INPUT,
  );
}

/** On-time readiness: bookings Family Ready before the deadline, over bookings Family Ready. */
export function onTimeReadinessFigure(counts: { family_ready_bookings: number; with_deadline: number; on_time: number }): KpiFigure {
  return rateFigure(
    { total: counts.family_ready_bookings, with_input: counts.with_deadline, matched: counts.on_time },
    ON_TIME_READINESS_MISSING_INPUT,
  );
}
