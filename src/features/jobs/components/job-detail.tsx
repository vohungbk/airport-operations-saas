import type { ReactNode } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ChangeJobStatusDialog } from "@/features/jobs/components/change-job-status-dialog";
import { JobEventsTimeline } from "@/features/jobs/components/job-events-timeline";
import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import type { JobTargetStatus } from "@/features/jobs/lib/job-status";
import { JOB_TYPE_LABEL } from "@/features/jobs/lib/job-type";
import type { JobDetailItem, JobEventItem } from "@/features/jobs/types";

interface JobDetailProps {
  job: JobDetailItem;
  events: JobEventItem[];
  eventsTruncated: boolean;
  /** Transitions the current user may make; empty hides the control. */
  allowedStatuses: JobTargetStatus[];
  /** Matching workflow screen; null hides the "Record work" link. */
  workRecordHref: string | null;
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

/**
 * The only edit here is the status, through the dialog and the database
 * function behind it. Everything else is read-only.
 */
export function JobDetail({
  job,
  events,
  eventsTruncated,
  allowedStatuses,
  workRecordHref,
}: JobDetailProps) {
  const { booking } = job;

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Job {booking?.booking_number ?? ""}
          </h1>
          <JobStatusBadge status={job.status} />
        </div>
        <div className="flex items-center gap-2">
          {workRecordHref && (
            <Link href={workRecordHref} className={buttonVariants()}>
              Record work
            </Link>
          )}
          {allowedStatuses.length > 0 && (
            <ChangeJobStatusDialog
              // New form state when the status moves, so the defaults match.
              key={job.status}
              jobId={job.id}
              jobLabel={booking?.booking_number ?? "job"}
              currentStatus={job.status}
              allowedStatuses={allowedStatuses}
            />
          )}
          <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
            Back to jobs
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-foreground">Job</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Job type">{JOB_TYPE_LABEL[job.job_type]}</Detail>
          <Detail label="Technician">{job.technician?.full_name ?? "-"}</Detail>
          <Detail label="Assigned">{formatDateTime(job.assigned_at)}</Detail>
          <Detail label="Started">{formatDateTime(job.started_at)}</Detail>
          <Detail label="Completed">{formatDateTime(job.completed_at)}</Detail>
          <Detail label="Vehicle bay">
            {job.vehicle_bay ?? booking?.vehicle_bay ?? "-"}
          </Detail>
          <Detail label="Installation notes">
            {job.installation_notes ?? "-"}
          </Detail>
        </dl>
      </section>

      {booking && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-foreground">Booking</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Booking number">{booking.booking_number}</Detail>
            <Detail label="Airport">
              {booking.airport
                ? `${booking.airport.code} - ${booking.airport.name}`
                : "-"}
            </Detail>
            <Detail label="Pickup">{formatDateTime(booking.pickup_at)}</Detail>
            <Detail label="Return">{formatDateTime(booking.return_at)}</Detail>
            <Detail label="Vehicle">{booking.vehicle ?? "-"}</Detail>
            <Detail label="Child age band">{booking.child_age_band ?? "-"}</Detail>
            <Detail label="Child height">
              {booking.child_height === null ? "-" : `${booking.child_height} cm`}
            </Detail>
            <Detail label="Seat">
              {booking.seat
                ? `${booking.seat.serial_number}${
                    booking.seat.category ? ` (${booking.seat.category.name})` : ""
                  }`
                : "Not assigned yet"}
            </Detail>
          </dl>
        </section>
      )}

      <JobEventsTimeline events={events} truncated={eventsTruncated} />
    </div>
  );
}
