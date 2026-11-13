import type { ReactNode } from "react";
import Link from "next/link";
import { CircleCheckIcon, ClockIcon, LockIcon, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookingFlightPanel } from "@/features/bookings/components/booking-flight-panel";
import { getInstallationDeadline } from "@/features/flights/lib/flight-panel";
import { SeatStatusBadge } from "@/features/seats/components/seat-status-badge";
import { ChangeJobStatusDialog } from "@/features/jobs/components/change-job-status-dialog";
import { SavedToast } from "@/features/jobs/components/saved-toast";
import { JobWorkTabs } from "@/features/jobs/components/job-work-tabs";
import type { SeatLastWorkState } from "@/features/jobs/lib/get-seat-last-work";
import { JobEventsTimeline } from "@/features/jobs/components/job-events-timeline";
import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import type { JobTargetStatus } from "@/features/jobs/lib/job-status";
import { formatJobDeadline } from "@/features/jobs/lib/job-deadline";
import { buildJobSteps, JOB_STEP_STATE_LABEL, type JobStepState } from "@/features/jobs/lib/job-steps";
import { JOB_TYPE_LABEL } from "@/features/jobs/lib/job-type";
import { cn } from "@/lib/utils";
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
  /** Which names link to their own page; a person without access to that page sees plain text. */
  links?: { seat: boolean; booking: boolean; technician: boolean };
  /** The last cleaning and inspection of the seat; null hides the line. */
  lastWork?: Promise<SeatLastWorkState> | null;
  /** A step that was just saved, from the address; shows its toast once. */
  saved?: "inspection" | "job" | null;
  /** Where the Edit button goes, for a manager; `null` hides it. */
  editHref?: string | null;
}

/** `04 Nov 2026 14:30 GST`, in the airport time zone; `-` when the value is empty. */
function formatDateTime(value: string | null, timeZone: string): string {
  return value ? formatJobDeadline(value, timeZone) : "-";
}

const NO_LINKS = { seat: false, booking: false, technician: false };

/** A label and its value on one row of a card; the value wraps instead of pushing the card wider. */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[7.5rem_1fr] items-start gap-3 sm:grid-cols-[9rem_1fr]">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-foreground">{children}</dd>
    </div>
  );
}

export function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <dl className="flex flex-col gap-3">{children}</dl>
      </CardContent>
    </Card>
  );
}

export function NameLink({ href, children }: { href: string | null; children: ReactNode }) {
  return href ? (
    <Link href={href} className="text-primary underline underline-offset-2 hover:no-underline">
      {children}
    </Link>
  ) : (
    <>{children}</>
  );
}

const STEP_ICON: Record<JobStepState, LucideIcon> = {
  completed: CircleCheckIcon,
  current: ClockIcon,
  locked: LockIcon,
};

/**
 * The only edit here is the status, through the dialog and the database function behind it. Everything
 * else is read-only. Layout of the design: the job number with the status and type badges and the actions;
 * under it, the Job, Seat, Booking and Technician cards at the left, and the Job steps, the panel of the
 * job type and the Timeline at the right. Every time is in the time zone of the airport.
 */
export function JobDetail({
  job,
  events,
  eventsTruncated,
  allowedStatuses,
  workRecordHref,
  scanHref = null,
  reportIncidentHref = null,
  links = NO_LINKS,
  lastWork = null,
  saved = null,
  editHref = null,
}: JobDetailProps) {
  const { booking } = job;
  const timeZone = booking?.airport?.timezone ?? "UTC";
  const typeLabel = JOB_TYPE_LABEL[job.job_type];
  const seat = booking?.seat ?? null;
  const steps = buildJobSteps(job.status, job.job_type);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      {saved === "inspection" && <SavedToast message="Inspection saved" />}
      {saved === "job" && <SavedToast message="Job saved" />}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <h1 className="min-w-0 text-2xl leading-8 font-semibold break-words text-primary-subtle-foreground">
          {job.job_number}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <JobStatusBadge status={job.status} />
          <Badge variant="outline" className="h-6 rounded-lg px-3 text-sm">
            {typeLabel}
          </Badge>
          {reportIncidentHref && (
            <Link
              href={reportIncidentHref}
              className={buttonVariants({
                variant: "outline",
                className: "min-h-11 rounded-lg bg-surface px-4",
              })}
            >
              Report incident
            </Link>
          )}
          {allowedStatuses.length > 0 && (
            <ChangeJobStatusDialog
              jobId={job.id}
              jobLabel={job.job_number}
              currentStatus={job.status}
              allowedStatuses={allowedStatuses}
            />
          )}
          {editHref && (
            <Link
              href={editHref}
              className={buttonVariants({
                variant: "outline",
                className: "min-h-11 rounded-lg bg-surface px-4",
              })}
            >
              Edit
            </Link>
          )}
          <Link
            href="/jobs"
            className={buttonVariants({
              variant: "outline",
              className: "min-h-11 rounded-lg bg-surface px-4",
            })}
          >
            Back to jobs
          </Link>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <DetailCard title="Job">
            <Detail label="Job number">{job.job_number}</Detail>
            <Detail label="Type">{typeLabel}</Detail>
            <Detail label="Status">
              <JobStatusBadge status={job.status} />
            </Detail>
            <Detail label="Deadline">
              {job.deadline_at ? formatJobDeadline(job.deadline_at, timeZone) : "No deadline"}
            </Detail>
            <Detail label="Created">{formatDateTime(job.created_at, timeZone)}</Detail>
            {job.started_at && <Detail label="Started">{formatDateTime(job.started_at, timeZone)}</Detail>}
            {job.completed_at && (
              <Detail label="Completed">{formatDateTime(job.completed_at, timeZone)}</Detail>
            )}
            {(job.vehicle_bay ?? booking?.vehicle_bay) && (
              <Detail label="Vehicle bay">{job.vehicle_bay ?? booking?.vehicle_bay}</Detail>
            )}
            {job.installation_notes && <Detail label="Installation notes">{job.installation_notes}</Detail>}
          </DetailCard>

          <DetailCard title="Seat">
            <Detail label="Seat">
              {seat ? (
                <NameLink href={links.seat ? `/seats/${seat.id}` : null}>{seat.serial_number}</NameLink>
              ) : (
                "Not assigned yet"
              )}
            </Detail>
            {seat && (
              <Detail label="Seat status">
                <SeatStatusBadge status={seat.status} />
              </Detail>
            )}
            {seat?.category && <Detail label="Category">{seat.category.name}</Detail>}
          </DetailCard>

          {booking && (
            <DetailCard title="Booking">
              <Detail label="Booking">
                <NameLink href={links.booking ? `/bookings/${booking.id}` : null}>
                  {booking.booking_number}
                </NameLink>
              </Detail>
              {booking.partner && <Detail label="Partner">{booking.partner.name}</Detail>}
              <Detail label="Pickup">{formatDateTime(booking.pickup_at, timeZone)}</Detail>
              <Detail label="Return">{formatDateTime(booking.return_at, timeZone)}</Detail>
              {booking.vehicle && <Detail label="Vehicle">{booking.vehicle}</Detail>}
              {booking.child_age_band && <Detail label="Child age band">{booking.child_age_band}</Detail>}
              {booking.child_height !== null && (
                <Detail label="Child height">{`${booking.child_height} cm`}</Detail>
              )}
            </DetailCard>
          )}

          <DetailCard title="Technician">
            <Detail label="Technician">
              {job.technician ? (
                <NameLink href={links.technician ? `/technicians/${job.technician.id}` : null}>
                  {job.technician.full_name}
                </NameLink>
              ) : (
                <span className="text-text-muted">Unassigned</span>
              )}
            </Detail>
            <Detail label="Airport">{booking?.airport?.code ?? "-"}</Detail>
          </DetailCard>

          {booking && (
            <BookingFlightPanel
              flight={booking.flight}
              timeZone={timeZone}
              city={booking.airport?.city}
              deadlineAt={getInstallationDeadline([
                { deadline_at: job.deadline_at, status: job.status, job_type: job.job_type },
              ])}
              pickupAt={booking.pickup_at}
              flightNumber={booking.flight_number}
              lookupStatus={booking.flight_lookup_status}
            />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="job-steps" className="flex flex-col gap-3">
            <h2 id="job-steps" className="text-base font-semibold text-foreground">
              Job steps
            </h2>
            <ol className="grid gap-3 sm:grid-cols-3">
              {steps.map((step) => {
                const Icon = STEP_ICON[step.state];

                return (
                  <li
                    key={step.label}
                    data-state={step.state}
                    aria-current={step.state === "current" ? "step" : undefined}
                    className={cn(
                      "flex min-w-0 flex-col gap-2 rounded-lg p-3 text-sm",
                      step.state === "current"
                        ? "bg-primary-subtle text-primary-subtle-foreground"
                        : "bg-surface-muted text-foreground",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    <span className="font-medium break-words">{step.label}</span>
                    <span className="text-text-muted">{JOB_STEP_STATE_LABEL[step.state]}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <JobWorkTabs
            jobType={job.job_type}
            jobStatus={job.status}
            seat={seat}
            seatLink={links.seat}
            workRecordHref={workRecordHref}
            scanHref={scanHref}
            lastWork={lastWork}
            timeZone={timeZone}
          />

          <Card>
            <CardContent>
              <JobEventsTimeline events={events} truncated={eventsTruncated} timeZone={timeZone} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
