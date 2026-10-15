import Link from "next/link";

import {
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

const SORTABLE: Record<"status" | "assigned_at", { key: JobsSortColumn; label: string }> = {
  status: { key: "status", label: "Status" },
  assigned_at: { key: "assigned_at", label: "Assigned" },
};

function SortHeader({ query, column }: { query: JobsQuery; column: JobsSortColumn }) {
  const { key, label } = SORTABLE[column];

  return (
    <TableHead>
      <Link
        href={buildJobsHref(query, {
          sort: key,
          order: query.sort === key && query.order === "asc" ? "desc" : "asc",
          page: 1,
        })}
        className="flex items-center gap-1 hover:text-foreground"
      >
        {label}
        {query.sort === key && (
          <span aria-hidden="true">{query.order === "asc" ? "↑" : "↓"}</span>
        )}
      </Link>
    </TableHead>
  );
}

/**
 * Server Component. Rows are not links yet: Job detail ships with
 * FO-F01-S03, so there is no page to open.
 */
export function JobsTable({ jobs, query }: JobsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Booking</TableHead>
          <TableHead>Technician</TableHead>
          <SortHeader query={query} column="status" />
          <SortHeader query={query} column="assigned_at" />
          <TableHead>Vehicle bay</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => (
          <TableRow key={job.id}>
            <TableCell className="font-medium">
              {job.booking?.booking_number ?? "—"}
            </TableCell>
            <TableCell>{job.technician?.full_name ?? "—"}</TableCell>
            <TableCell>
              <JobStatusBadge status={job.status} />
            </TableCell>
            <TableCell>{new Date(job.assigned_at).toLocaleString()}</TableCell>
            <TableCell>{job.vehicle_bay ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
