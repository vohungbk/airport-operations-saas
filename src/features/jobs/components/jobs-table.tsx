import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JobDeadlineCell } from "@/features/jobs/components/job-deadline-cell";
import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import { buildJobDeadlineView } from "@/features/jobs/lib/job-deadline";
import { JOB_TYPE_LABEL } from "@/features/jobs/lib/job-type";
import type { JobListItem } from "@/features/jobs/types";

interface JobsTableProps {
  jobs: JobListItem[];
  /** Passed in so a test can fix the time; the page leaves it out. */
  now?: Date;
}

const HEAD_CLASS = "h-auto px-0 py-0 py-3 pr-4 text-xs font-semibold leading-4 text-text-muted";
const CELL_CLASS = "py-3 pr-4 text-sm leading-5 whitespace-normal break-words text-foreground";

/**
 * Server Component. Columns of the design: job number, type, seat, booking, technician, deadline, status
 * and a View action. An open job past its deadline shows the Overdue badge in the Status column too. Below
 * 640 px the table is a list of cards; from 640 px up it is the table.
 */
export function JobsTable({ jobs, now = new Date() }: JobsTableProps) {
  return (
    <Table stacked>
      <TableHeader className="bg-surface-muted [&_tr]:border-b">
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${HEAD_CLASS} pl-4`}>Job number</TableHead>
          <TableHead className={HEAD_CLASS}>Type</TableHead>
          <TableHead className={HEAD_CLASS}>Seat</TableHead>
          <TableHead className={HEAD_CLASS}>Booking</TableHead>
          <TableHead className={HEAD_CLASS}>Technician</TableHead>
          <TableHead className={HEAD_CLASS}>Deadline</TableHead>
          <TableHead className={HEAD_CLASS}>Status</TableHead>
          <TableHead className={HEAD_CLASS}>Row action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => {
          const deadline = buildJobDeadlineView(job, job.booking?.airport?.timezone ?? "UTC", now);

          return (
            <TableRow key={job.id} className="transition-colors hover:bg-primary-subtle">
              <TableCell data-label="Job number" className={`${CELL_CLASS} pl-4 font-medium`}>
                <Link href={`/jobs/${job.id}`} className="hover:underline">
                  {job.job_number}
                </Link>
              </TableCell>
              <TableCell data-label="Type" className={CELL_CLASS}>
                {JOB_TYPE_LABEL[job.job_type]}
              </TableCell>
              <TableCell data-label="Seat" className={CELL_CLASS}>
                {job.booking?.seat?.serial_number ?? "—"}
              </TableCell>
              <TableCell data-label="Booking" className={CELL_CLASS}>
                {job.booking?.booking_number ?? "—"}
              </TableCell>
              <TableCell
                data-label="Technician"
                title={job.technician?.full_name}
                className={job.technician ? CELL_CLASS : `${CELL_CLASS} text-text-muted`}
              >
                {job.technician?.full_name ?? "Unassigned"}
              </TableCell>
              <TableCell data-label="Deadline" className={CELL_CLASS}>
                <JobDeadlineCell view={deadline} />
              </TableCell>
              <TableCell data-label="Status" className={CELL_CLASS}>
                {deadline.kind === "overdue" ? (
                  <Badge variant="warning">
                    <TriangleAlertIcon aria-hidden="true" />
                    Overdue
                  </Badge>
                ) : (
                  <JobStatusBadge status={job.status} />
                )}
              </TableCell>
              <TableCell data-label="Row action" className={CELL_CLASS}>
                <Link
                  href={`/jobs/${job.id}`}
                  aria-label={`View job ${job.job_number}`}
                  className={buttonVariants({ variant: "outline", className: "min-h-11 rounded-lg bg-surface px-4" })}
                >
                  View
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
