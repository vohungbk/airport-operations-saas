/**
 * Pure flight timing logic for the flight status card and alert (UI-F04-S01, spec R1, E1). A flight
 * is early or late by the gap between its estimated (or actual) and scheduled arrival; the stored
 * `delay_minutes` is used only when there is no estimate. Nothing is guessed: with neither, the
 * offset is unknown.
 */

export const ALERT_THRESHOLD_MINUTES = 15;
export const STALE_AFTER_MINUTES = 30;

export interface FlightTimes {
  scheduled_arrival_at: string;
  estimated_arrival_at: string | null;
  actual_arrival_at: string | null;
  delay_minutes: number | null;
}

const MS_PER_MINUTE = 60_000;

/** Minutes the flight is late (positive) or early (negative); null when it cannot be told. */
export function getFlightOffsetMinutes(flight: FlightTimes): number | null {
  const expected = flight.actual_arrival_at ?? flight.estimated_arrival_at;
  if (expected) {
    const gap = (Date.parse(expected) - Date.parse(flight.scheduled_arrival_at)) / MS_PER_MINUTE;
    return Number.isFinite(gap) ? Math.round(gap) : null;
  }
  return flight.delay_minutes;
}

export type FlightTiming = "early" | "delayed" | "on_time" | "unknown";

export function classifyFlight(offset: number | null, threshold = ALERT_THRESHOLD_MINUTES): FlightTiming {
  if (offset === null) return "unknown";
  if (offset >= threshold) return "delayed";
  if (offset <= -threshold) return "early";
  return "on_time";
}

/** Whole minutes since the last sync; null when it never synced or the time is not a date. */
export function getDataAgeMinutes(lastSyncedAt: string | null, now: Date): number | null {
  if (!lastSyncedAt) return null;
  const age = (now.getTime() - Date.parse(lastSyncedAt)) / MS_PER_MINUTE;
  return Number.isFinite(age) ? Math.max(0, Math.floor(age)) : null;
}

/** Data that never synced is stale: it is not shown as current. */
export function isStale(ageMinutes: number | null, limit = STALE_AFTER_MINUTES): boolean {
  return ageMinutes === null || ageMinutes > limit;
}

export function formatAge(ageMinutes: number | null): string {
  if (ageMinutes === null) return "never updated";
  if (ageMinutes < 1) return "just now";
  if (ageMinutes < 60) return `${ageMinutes} min ago`;
  const hours = Math.floor(ageMinutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.floor(hours / 24)} d ago`;
}

export type FlightDisruption = "cancelled" | "diverted";

/**
 * The disruption of a flight, or null (VI-F02-S06, spec R10). Only the status says it: a cancelled or
 * diverted flight may still hold an old estimate, and that estimate is not read as early or late.
 */
export function getFlightDisruption(status: string | null | undefined): FlightDisruption | null {
  return status === "cancelled" || status === "diverted" ? status : null;
}

export function getDisruptionTitle(kind: FlightDisruption): string {
  return kind === "cancelled" ? "FLIGHT CANCELLED" : "FLIGHT DIVERTED";
}

/** What operations do with the flagged booking. */
export const DISRUPTION_ACTION = "Operations: replan this booking.";
