import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import type { JobForEdit } from "@/features/jobs/lib/get-job-for-edit";
import {
  formatDate,
  formatTime,
  zoneLabel,
} from "@/features/jobs/lib/job-time";

interface JobEditMetaProps {
  job: JobForEdit;
}

/** `11 Nov 2026, 10:42 GST`, in the time zone of the airport of the booking. */
export function formatLastUpdated(iso: string, timeZone: string): string {
  return `${formatDate(iso, timeZone)}, ${formatTime(iso, timeZone)} ${zoneLabel(timeZone)}`;
}

/** The read-only Job ID, status and last updated time above the Edit job card. */
export function JobEditMeta({ job }: JobEditMetaProps) {
  const timeZone = job.booking.airport?.timezone ?? "UTC";

  return (
    <dl className="mx-auto grid w-full max-w-xl grid-cols-3 gap-4 rounded-xl border bg-surface p-4 text-sm">
      <div className="flex flex-col gap-1">
        <dt className="text-xs text-text-muted">Job ID</dt>
        <dd className="font-medium text-foreground">{job.job_number}</dd>
      </div>
      <div className="flex flex-col items-start gap-1">
        <dt className="text-xs text-text-muted">Job status</dt>
        <dd>
          <JobStatusBadge status={job.status} />
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-xs text-text-muted">Last updated</dt>
        <dd className="text-foreground">
          {formatLastUpdated(job.updated_at, timeZone)}
        </dd>
      </div>
    </dl>
  );
}
