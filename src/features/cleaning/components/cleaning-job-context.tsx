import { Detail, DetailCard, NameLink } from "@/features/jobs/components/job-detail";
import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import { formatJobDeadline } from "@/features/jobs/lib/job-deadline";
import { JOB_TYPE_LABEL } from "@/features/jobs/lib/job-type";
import type { JobDetailItem } from "@/features/jobs/types";

interface CleaningJobContextProps {
  job: JobDetailItem;
  /** Which names link to their own page. */
  links: { booking: boolean; technician: boolean };
}

/** The Job, Booking and Technician cards at the right of the Cleaning panel. */
export function CleaningJobContext({ job, links }: CleaningJobContextProps) {
  const { booking } = job;
  const timeZone = booking?.airport?.timezone ?? "UTC";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DetailCard title="Job">
        <Detail label="Job number">{job.job_number}</Detail>
        <Detail label="Type">{JOB_TYPE_LABEL[job.job_type]}</Detail>
        <Detail label="Status">
          <JobStatusBadge status={job.status} />
        </Detail>
        <Detail label="Deadline">
          {job.deadline_at ? formatJobDeadline(job.deadline_at, timeZone) : "No deadline"}
        </Detail>
        <Detail label="Created">{formatJobDeadline(job.created_at, timeZone)}</Detail>
      </DetailCard>

      {booking && (
        <DetailCard title="Booking">
          <Detail label="Booking">
            <NameLink href={links.booking ? `/bookings/${booking.id}` : null}>
              {booking.booking_number}
            </NameLink>
          </Detail>
          {booking.partner && <Detail label="Partner">{booking.partner.name}</Detail>}
          <Detail label="Pickup">{formatJobDeadline(booking.pickup_at, timeZone)}</Detail>
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
    </div>
  );
}
