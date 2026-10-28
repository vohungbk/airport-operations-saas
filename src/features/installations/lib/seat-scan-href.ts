import { getWorkRecordHref } from "@/features/jobs/lib/work-record";

type WorkRecordArgs = Parameters<typeof getWorkRecordHref>;

/**
 * Href of the scan of the seat of a job, offered where the installation itself is offered: an active
 * installation job assigned to the user, who may record it. `null` otherwise. Only a visibility rule; the
 * scan page guards itself.
 */
export function getSeatScanHref(
  job: WorkRecordArgs[0],
  user: WorkRecordArgs[1],
): string | null {
  return job.job_type === "installation" && getWorkRecordHref(job, user)
    ? `/jobs/${job.id}/scan`
    : null;
}
