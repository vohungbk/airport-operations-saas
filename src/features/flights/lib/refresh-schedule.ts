/**
 * Pure rules of the flight refresh (VI-F02-S03, spec R7 and Q2): when a linked flight is due to be asked
 * from its source again. No I/O.
 *
 *   - More than 24 hours before the scheduled arrival: once, when it is linked (never synced = due).
 *   - 24 hours to 3 hours before: every 30 minutes.
 *   - The last 3 hours (and a flight that is late, past its scheduled time): every 5 minutes.
 *   - Landed or cancelled: never.
 */

export const FAR_WINDOW_HOURS = 24;
export const NEAR_WINDOW_HOURS = 3;
export const MID_INTERVAL_MINUTES = 30;
export const NEAR_INTERVAL_MINUTES = 5;

/**
 * The job runs on a fixed beat (every 5 minutes) and a refresh is stamped a few seconds after the beat
 * starts, so the next beat finds the flight a little younger than the interval. Without a grace it would
 * skip that beat and the flight would be refreshed every 10 minutes instead of every 5.
 */
export const GRACE_MINUTES = 1;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** The part of a flight the schedule reads. */
export interface RefreshableFlight {
  status: string;
  scheduled_arrival_at: string;
  last_synced_at: string | null;
}

/** A flight that landed or was cancelled is final: it is not refreshed any more. */
export function isRefreshFinal(status: string): boolean {
  return status === "landed" || status === "cancelled";
}

/**
 * Minutes between two refreshes at this moment; null when the flight is far away and is not refreshed
 * again after it was linked.
 */
export function getRefreshIntervalMinutes(scheduledArrivalAt: string, now: Date): number | null {
  const untilArrival = Date.parse(scheduledArrivalAt) - now.getTime();

  if (!Number.isFinite(untilArrival)) return null;
  if (untilArrival > FAR_WINDOW_HOURS * HOUR_MS) return null;
  if (untilArrival > NEAR_WINDOW_HOURS * HOUR_MS) return MID_INTERVAL_MINUTES;
  return NEAR_INTERVAL_MINUTES;
}

/** True when the flight is to be asked from its source now. */
export function isRefreshDue(flight: RefreshableFlight, now: Date): boolean {
  if (isRefreshFinal(flight.status)) return false;

  // Never synced: it is asked once, whatever its distance.
  if (!flight.last_synced_at) return true;

  const interval = getRefreshIntervalMinutes(flight.scheduled_arrival_at, now);
  if (interval === null) return false;

  const age = (now.getTime() - Date.parse(flight.last_synced_at)) / MINUTE_MS;

  // A sync time that is not a date, or lies in the future, cannot be trusted: ask again.
  if (!Number.isFinite(age) || age < 0) return true;

  return age >= interval - GRACE_MINUTES;
}
