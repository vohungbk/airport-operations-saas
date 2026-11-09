import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import { JOB_TYPE_LABEL } from "@/features/jobs/lib/job-type";
import { formatLastUpdate } from "@/features/technicians/lib/format-last-update";
import { getTechnicianInitials } from "@/features/technicians/lib/get-technician-initials";
import type {
  Technician,
  TechnicianActivity,
} from "@/features/technicians/types";

interface TechnicianDetailProps {
  technician: Technician;
  activity: TechnicianActivity;
}

const HEAD_CLASS =
  "h-auto py-0 pr-3 pl-0 text-[11px] font-normal uppercase leading-4 text-foreground";
const CELL_CLASS = "py-3 pr-3 pl-0 text-sm leading-5 text-foreground";

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] leading-4 text-text-muted uppercase">{label}</p>
      <p className="text-xl leading-7 font-semibold text-foreground">{value}</p>
    </div>
  );
}

/**
 * Server Component, read-only. The jobs link to the job page, which is where
 * a job is worked on.
 */
export function TechnicianDetail({
  technician,
  activity,
}: TechnicianDetailProps) {
  const { airport, jobs } = activity;

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center gap-6">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-base leading-6 font-semibold text-foreground"
        >
          {getTechnicianInitials(technician.full_name)}
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl leading-7 font-semibold text-foreground">
            {technician.full_name}
          </h1>
          <p className="text-sm leading-5 text-text-muted">
            {airport ? `${airport.name} (${airport.code}) · ${airport.timezone}` : "—"}
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <SummaryCard label="Open jobs" value={activity.open_jobs} />
        <SummaryCard
          label="Jobs done this week"
          value={activity.jobs_done_this_week}
        />
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
        <Table>
          <TableHeader className="bg-surface-muted [&_tr]:border-b">
            <TableRow className="hover:bg-transparent">
              <TableHead className={`${HEAD_CLASS} w-[160px] py-3 pl-4`}>
                Job number
              </TableHead>
              <TableHead className={`${HEAD_CLASS} w-[100px] py-3`}>Type</TableHead>
              <TableHead className={`${HEAD_CLASS} w-[100px] py-3`}>Seat</TableHead>
              <TableHead className={`${HEAD_CLASS} w-[150px] py-3`}>
                Booking
              </TableHead>
              <TableHead className={`${HEAD_CLASS} w-[140px] py-3`}>
                Status
              </TableHead>
              <TableHead className={`${HEAD_CLASS} w-[140px] py-3`}>
                Last update
              </TableHead>
              <TableHead className={`${HEAD_CLASS} w-[90px] py-3 pr-4`}>
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className={`${CELL_CLASS} pl-4 font-medium`}>
                  {job.job_number}
                </TableCell>
                <TableCell className={CELL_CLASS}>
                  {JOB_TYPE_LABEL[job.job_type]}
                </TableCell>
                <TableCell className={CELL_CLASS}>
                  {job.seat_serial_number ?? "—"}
                </TableCell>
                <TableCell className={CELL_CLASS}>
                  {job.booking_number ?? "—"}
                </TableCell>
                <TableCell className={CELL_CLASS}>
                  <JobStatusBadge status={job.status} />
                </TableCell>
                <TableCell className={`${CELL_CLASS} text-text-muted`}>
                  {formatLastUpdate(job.updated_at, job.timezone)}
                </TableCell>
                <TableCell className={`${CELL_CLASS} pr-4`}>
                  <Link
                    href={`/jobs/${job.id}`}
                    aria-label={`View job ${job.job_number}`}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {jobs.length === 0 && (
          <p className="px-4 py-6 text-sm text-text-muted">No jobs yet.</p>
        )}
      </div>
    </div>
  );
}
