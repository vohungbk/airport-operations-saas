import Link from "next/link";

import {
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import { buildJobsHref } from "@/features/jobs/lib/build-jobs-href";
import type { JobListItem } from "@/features/jobs/types";
import type {
  JobsQuery,
  JobsSortColumn,
} from "@/features/jobs/schemas/jobs-query.schema";

interface JobsTableProps {
  jobs: JobListItem[];
  query: JobsQuery;
}

const SORTABLE: Record<"status" | "assigned_at", string> = {
  status: "Status",
  assigned_at: "Assigned",
};

function SortHeader({
  query,
  column,
}: {
  query: JobsQuery;
  column: JobsSortColumn;
}) {
  const isActive = query.sort === column;

  return (
    <SortableTableHead
      href={buildJobsHref(query, {
        sort: column,
        order: isActive && query.order === "asc" ? "desc" : "asc",
        page: 1,
      })}
      label={SORTABLE[column]}
      direction={isActive ? query.order : null}
      idleIcon
    />
  );
}

/**
 * Server Component. The link on the booking number is stretched over the row, so the whole row opens the
 * job with no script and the keyboard reaches it. Below 640 px the table is a list of cards (UI-F06-S04,
 * spec R10); from 640 px up it is the table it was.
 */
export function JobsTable({ jobs, query }: JobsTableProps) {
  return (
    <div className="min-w-0 sm:overflow-hidden sm:rounded-lg sm:border sm:bg-card">
      <Table stacked>
        <TableHeader className="sm:bg-muted [&_th]:h-13 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase [&_th_a]:text-[11px] [&_th_a]:font-semibold">
          <TableRow>
            <TableHead>Booking</TableHead>
            <TableHead>Technician</TableHead>
            <SortHeader query={query} column="status" />
            <SortHeader query={query} column="assigned_at" />
            <TableHead>Vehicle bay</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="sm:[&_tr]:border-0">
          {jobs.map((job) => (
            <TableRow
              key={job.id}
              className="relative cursor-pointer focus-within:bg-muted/50 sm:h-13"
            >
              <TableCell data-label="Booking" className="font-mono text-[13px]">
                <Link
                  href={`/jobs/${job.id}`}
                  aria-label={`View job ${job.booking?.booking_number ?? ""}`.trim()}
                  className="after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {job.booking?.booking_number ?? "View job"}
                </Link>
              </TableCell>
              <TableCell
                data-label="Technician"
                title={job.technician?.full_name}
                className="max-w-48 truncate max-sm:max-w-none"
              >
                {job.technician?.full_name ?? "—"}
              </TableCell>
              <TableCell data-label="Status">
                <JobStatusBadge status={job.status} />
              </TableCell>
              <TableCell data-label="Assigned">
                {new Date(job.assigned_at).toLocaleString()}
              </TableCell>
              <TableCell data-label="Vehicle bay">
                {job.vehicle_bay ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
