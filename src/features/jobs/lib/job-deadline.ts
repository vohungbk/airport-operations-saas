import type { JobStatus } from "@/features/jobs/lib/job-status";
import { zoneLabel } from "@/features/jobs/lib/job-time";

/**
 * The one place that decides what a job deadline means (UI-F06-T01). The jobs list, its Overdue and Today
 * chips and the Overdue tasks tile of the Command Centre all read it, so a figure and the list it links to
 * count the same jobs. A job with no deadline is never overdue. Pure, no I/O.
 */

/** A job that still has work to do. Completed and cancelled jobs are never overdue. */
export const OPEN_JOB_STATUSES = ["assigned", "in_progress"] as const satisfies readonly JobStatus[];

export const JOB_DEADLINE_FILTERS = ["today", "overdue"] as const;

export type JobDeadlineFilter = (typeof JOB_DEADLINE_FILTERS)[number];

export const JOB_DEADLINE_FILTER_LABEL: Record<JobDeadlineFilter, string> = {
  today: "Today",
  overdue: "Overdue",
};

const DAY_MS = 86_400_000;

interface DeadlineJob {
  status: JobStatus;
  deadline_at: string | null;
}

/** Overdue once the deadline has passed and the job is still open; the deadline itself is still on time. */
export function isJobOverdue(job: DeadlineJob, now: Date): boolean {
  if (job.deadline_at === null) return false;
  if (!(OPEN_JOB_STATUSES as readonly JobStatus[]).includes(job.status)) return false;

  return now.getTime() > new Date(job.deadline_at).getTime();
}

/** What a deadline filter asks of `technician_jobs`, as values a query applies; `now` is passed in. */
export interface JobDeadlineRange {
  open_only: boolean;
  /** `deadline_at >= from` */
  from?: string;
  /** `deadline_at < before` */
  before?: string;
}

/**
 * Overdue: open jobs whose deadline is before now. Today: deadline inside the UTC day of `now` (the day
 * the dashboard and Today's Jobs use). A job with no deadline matches neither.
 */
export function getJobDeadlineRange(filter: JobDeadlineFilter, now: Date): JobDeadlineRange {
  if (filter === "overdue") {
    return { open_only: true, before: now.toISOString() };
  }

  const start = Math.floor(now.getTime() / DAY_MS) * DAY_MS;

  return {
    open_only: false,
    from: new Date(start).toISOString(),
    before: new Date(start + DAY_MS).toISOString(),
  };
}

/** `04 Nov 2026 14:30 GST`, in the time zone of the airport. */
export function formatJobDeadline(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(iso));

  // en-GB writes "04 Nov 2026, 14:30"; the design has no comma.
  return `${parts.replace(",", "")} ${zoneLabel(timeZone)}`;
}

export type JobDeadlineView =
  | { kind: "none" }
  | { kind: "on_time"; label: string }
  | { kind: "overdue"; label: string };

/** What the Deadline cell writes: nothing stored, a date, or an overdue date. */
export function buildJobDeadlineView(job: DeadlineJob, timeZone: string, now: Date): JobDeadlineView {
  if (job.deadline_at === null) return { kind: "none" };

  const label = formatJobDeadline(job.deadline_at, timeZone);

  return isJobOverdue(job, now) ? { kind: "overdue", label } : { kind: "on_time", label };
}

interface DeadlineQuery {
  in(column: string, values: readonly string[]): DeadlineQuery;
  gte(column: string, value: string): DeadlineQuery;
  lt(column: string, value: string): DeadlineQuery;
}

/**
 * Applies a deadline filter to a `technician_jobs` request, for the list and for the count of the tile.
 * Typed loosely on purpose: it only chains `in`, `gte` and `lt` on columns of that table.
 */
export function applyJobDeadlineFilter<Q>(request: Q, filter: JobDeadlineFilter, now: Date): Q {
  const range = getJobDeadlineRange(filter, now);
  let next = request as unknown as DeadlineQuery;

  if (range.open_only) next = next.in("status", OPEN_JOB_STATUSES);
  if (range.from) next = next.gte("deadline_at", range.from);
  if (range.before) next = next.lt("deadline_at", range.before);

  return next as unknown as Q;
}
