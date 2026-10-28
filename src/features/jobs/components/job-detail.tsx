import type { ReactNode } from "react";
import Link from "next/link";
import { ScanLine } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  /** The scan of the seat of this job; null hides the button. */
  scanHref?: string | null;
  /** The incident report form for this job; null hides the link. */
  reportIncidentHref?: string | null;
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 text-sm break-words text-foreground">
        {children}
      </dd>
    </div>
  );
}

/**
 * The only edit here is the status, through the dialog and the database
 * function behind it. Everything else is read-only. The layout is the one of the bookings detail
 * (UI-F06-S04): a heading with the status below it, the actions at the right, and a card for each group.
 */
export function JobDetail({
  job,
  events,
  eventsTruncated,
  allowedStatuses,
  workRecordHref,
  scanHref = null,
  reportIncidentHref = null,
}: JobDetailProps) {
  const { booking } = job;

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight break-words text-foreground">
            Job {booking?.booking_number ?? ""}
          </h1>
          <div>
            <JobStatusBadge status={job.status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scanHref && (
            <Link
              href={scanHref}
              className={buttonVariants({ className: "min-h-11 px-4" })}
            >
              <ScanLine aria-hidden="true" data-icon="inline-start" />
              Scan assigned seat
            </Link>
          )}
          {workRecordHref && (
            <Link
              href={workRecordHref}
              className={buttonVariants({ className: "min-h-11 px-4" })}
            >
              Record work
            </Link>
          )}
          {reportIncidentHref && (
            <Link
              href={reportIncidentHref}
              className={buttonVariants({
                variant: "outline",
                className: "min-h-11 px-4",
              })}
            >
              Report incident
            </Link>
          )}
          {allowedStatuses.length > 0 && (
            <ChangeJobStatusDialog
              jobId={job.id}
              jobLabel={booking?.booking_number ?? "job"}
              currentStatus={job.status}
              allowedStatuses={allowedStatuses}
            />
          )}
          <Link
            href="/jobs"
            className={buttonVariants({
              variant: "outline",
              className: "min-h-11 px-4",
            })}
          >
            Back to jobs
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Job
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Job type">{JOB_TYPE_LABEL[job.job_type]}</Detail>
            <Detail label="Technician">
              {job.technician?.full_name ?? "-"}
            </Detail>
            <Detail label="Assigned">{formatDateTime(job.assigned_at)}</Detail>
            <Detail label="Started">{formatDateTime(job.started_at)}</Detail>
            <Detail label="Completed">
              {formatDateTime(job.completed_at)}
            </Detail>
            <Detail label="Vehicle bay">
              {job.vehicle_bay ?? booking?.vehicle_bay ?? "-"}
            </Detail>
            <Detail label="Installation notes">
              {job.installation_notes ?? "-"}
            </Detail>
          </dl>
        </CardContent>
      </Card>

      {booking && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Booking
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Booking number">{booking.booking_number}</Detail>
              <Detail label="Airport">
                {booking.airport
                  ? `${booking.airport.code} - ${booking.airport.name}`
                  : "-"}
              </Detail>
              <Detail label="Pickup">
                {formatDateTime(booking.pickup_at)}
              </Detail>
              <Detail label="Return">
                {formatDateTime(booking.return_at)}
              </Detail>
              <Detail label="Vehicle">{booking.vehicle ?? "-"}</Detail>
              <Detail label="Child age band">
                {booking.child_age_band ?? "-"}
              </Detail>
              <Detail label="Child height">
                {booking.child_height === null
                  ? "-"
                  : `${booking.child_height} cm`}
              </Detail>
              <Detail label="Seat">
                {booking.seat
                  ? `${booking.seat.serial_number}${
                      booking.seat.category
                        ? ` (${booking.seat.category.name})`
                        : ""
                    }`
                  : "Not assigned yet"}
              </Detail>
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <JobEventsTimeline events={events} truncated={eventsTruncated} />
        </CardContent>
      </Card>
    </div>
  );
}
