import { Detail, DetailCard, NameLink } from "@/features/jobs/components/job-detail";
import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import { SeatStatusBadge } from "@/features/seats/components/seat-status-badge";
import { formatJobDeadline } from "@/features/jobs/lib/job-deadline";
import { JOB_TYPE_LABEL } from "@/features/jobs/lib/job-type";
import type { JobDetailItem } from "@/features/jobs/types";

interface InspectionJobContextProps {
  job: JobDetailItem;
  /** Which names link to their own page: a technician cannot open those pages. */
  links: { seat: boolean; technician: boolean };
}

/** The Job, Seat and Technician cards at the left of the Inspection record. */
export function InspectionJobContext({ job, links }: InspectionJobContextProps) {
  const { booking } = job;
  const timeZone = booking?.airport?.timezone ?? "UTC";
  const seat = booking?.seat ?? null;

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
      </DetailCard>

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
        <Detail label="Airport">
          {booking?.airport ? `${booking.airport.name} (${booking.airport.code})` : "-"}
        </Detail>
      </DetailCard>
    </div>
  );
}
