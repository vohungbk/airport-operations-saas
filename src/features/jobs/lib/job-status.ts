/** Mirrors the `technician_job_status` enum. */
export const JOB_STATUSES = [
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Statuses a person can move a job to (never back to `assigned`). */
export const JOB_TARGET_STATUSES = [
  "in_progress",
  "completed",
  "cancelled",
] as const satisfies readonly JobStatus[];

export type JobTargetStatus = (typeof JOB_TARGET_STATUSES)[number];

/** A reason is mandatory for these targets (stored as the event notes). */
const REASON_REQUIRED_STATUSES: readonly JobStatus[] = ["cancelled"];

const WORK_TRANSITIONS: Record<JobStatus, JobTargetStatus[]> = {
  assigned: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

const CANCELLABLE_STATUSES: readonly JobStatus[] = ["assigned", "in_progress"];

/**
 * Permitted transitions from `status`. Only managers may cancel. Must stay
 * in sync with `public.change_technician_job_status()`, which is the
 * enforcing authority.
 */
export function getAllowedJobTransitions(
  status: JobStatus,
  { canCancel }: { canCancel: boolean },
): JobTargetStatus[] {
  const targets = WORK_TRANSITIONS[status];

  return canCancel && CANCELLABLE_STATUSES.includes(status)
    ? [...targets, "cancelled"]
    : targets;
}

export function isJobReasonRequired(status: JobStatus): boolean {
  return REASON_REQUIRED_STATUSES.includes(status);
}
