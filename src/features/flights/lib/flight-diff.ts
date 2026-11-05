import type { FlightSnapshot, FlightSource } from "./provider/flight-source";

/**
 * Pure rules of the flight history (VI-F02-S03, spec R13): what changed between the flight as it is stored
 * and the flight as the source answers now. No I/O.
 */

/** The fields a refresh can change. The scheduled arrival is not one: it is what identifies the flight. */
export const TRACKED_FIELDS = [
  "status",
  "estimated_arrival_at",
  "actual_arrival_at",
  "terminal",
  "delay_minutes",
] as const;

export type TrackedField = (typeof TRACKED_FIELDS)[number];

/** A type alias, not an interface, so a list of changes is accepted as JSON by the database client. */
export type FlightChange = {
  field: TrackedField;
  from: string | number | null;
  to: string | number | null;
};

/** The part of a stored flight that a refresh compares and replaces. */
export type StoredFlightValues = Pick<FlightSnapshot, TrackedField>;

const TIME_FIELDS: ReadonlySet<TrackedField> = new Set(["estimated_arrival_at", "actual_arrival_at"]);

function isSame(field: TrackedField, from: string | number | null, to: string | number | null): boolean {
  if (from === to) return true;

  // The same instant written in two ways (`Z` and `+00:00`) is not a change.
  if (TIME_FIELDS.has(field) && typeof from === "string" && typeof to === "string") {
    return Date.parse(from) === Date.parse(to);
  }

  return false;
}

/** What differs, in the order of `TRACKED_FIELDS`; an empty list when the source says the same as the store. */
export function diffFlight(stored: StoredFlightValues, snapshot: StoredFlightValues): FlightChange[] {
  return TRACKED_FIELDS.flatMap((field) => {
    const from = stored[field];
    const to = snapshot[field];

    return isSame(field, from, to) ? [] : [{ field, from, to }];
  });
}

/** Who made the change, as the history names it: the live provider, or the system (sandbox data, simulator). */
export type HistorySource = "provider" | "system" | "manual";

export function toHistorySource(source: FlightSource): HistorySource {
  return source === "provider" ? "provider" : "system";
}
