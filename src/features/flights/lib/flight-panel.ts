import { OPEN_JOB_STATUSES } from "@/features/jobs/lib/job-deadline";
import { formatDate, formatTime, zoneLabel } from "@/features/jobs/lib/job-time";

/**
 * Pure rules of the flight status panel (VI-F02-S02): which deadline it shows, whether that deadline
 * moved, and how a time is written. No I/O.
 */

/** The installation deadline is counted from the pickup time (PRD 20.5): 60 minutes before it. */
export const BASE_DEADLINE_MINUTES = 60;

const MINUTE_MS = 60_000;

/** The part of a job the panel reads. */
export interface DeadlineJob {
  deadline_at: string | null;
  status: string;
  job_type: string;
}

/**
 * The deadline of the open installation job of a booking; null when there is none or it has no deadline.
 * With several open installation jobs, the earliest deadline is the one that matters.
 */
export function getInstallationDeadline(jobs: readonly DeadlineJob[] | null | undefined): string | null {
  const deadlines = (jobs ?? [])
    .filter(
      (job) =>
        job.job_type === "installation" &&
        job.deadline_at !== null &&
        (OPEN_JOB_STATUSES as readonly string[]).includes(job.status),
    )
    .map((job) => job.deadline_at as string)
    .sort((a, b) => Date.parse(a) - Date.parse(b));

  return deadlines[0] ?? null;
}

/** True when the stored deadline is not the base one (pickup minus 60 minutes): the flight moved it. */
export function isDeadlineMoved(deadlineAt: string | null, pickupAt: string | null | undefined): boolean {
  if (!deadlineAt || !pickupAt) return false;

  const base = Date.parse(pickupAt) - BASE_DEADLINE_MINUTES * MINUTE_MS;
  const stored = Date.parse(deadlineAt);

  return Number.isFinite(base) && Number.isFinite(stored) && stored !== base;
}

/** A landed flight is not refreshed any more (spec E5): its times are final, so they are not "stale". */
export function isFlightLanded(status: string): boolean {
  return status === "landed";
}

/**
 * The status badge repeats what the timing pill already says, so it shows only when there is no pill, or
 * when the flight has landed (the pill would not say that).
 */
export function shouldShowStatusBadge(status: string, hasTimingPill: boolean): boolean {
  return isFlightLanded(status) || !hasTimingPill;
}

/** `16:30 GST`, in the zone of the airport. */
export function formatClock(iso: string, timeZone: string): string {
  return `${formatTime(iso, timeZone)} ${zoneLabel(timeZone)}`;
}

/** `16:30 · 24 Oct 2026`, or `none` (a dash by default) when the time is not stored. */
export function formatFlightDateTime(iso: string | null, timeZone: string, none = "-"): string {
  return iso ? `${formatTime(iso, timeZone)} · ${formatDate(iso, timeZone)}` : none;
}

/** The end of the sync line: a landed flight is final, an old sync of any other flight is a warning. */
export function getSyncNote(status: string, hasSynced: boolean, stale: boolean): string {
  if (isFlightLanded(status)) return ". Landed: this flight is no longer refreshed.";
  return hasSynced && stale ? ". Times may be wrong." : "";
}

/** The second line of the banner: the estimate, and the moved deadline when the flight moved it. */
export function getBannerDetail(
  flightNumber: string,
  estimatedAt: string | null,
  deadlineAt: string | null,
  pickupAt: string | null | undefined,
  timeZone: string,
): string {
  const estimate = estimatedAt ? formatClock(estimatedAt, timeZone) : "-";
  const moved =
    deadlineAt && isDeadlineMoved(deadlineAt, pickupAt)
      ? ` Installation deadline moved to ${formatClock(deadlineAt, timeZone)}.`
      : "";

  return `${flightNumber} · Estimated ${estimate}.${moved}`;
}
