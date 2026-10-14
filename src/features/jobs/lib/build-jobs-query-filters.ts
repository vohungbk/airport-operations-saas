import { escapeIlikeValue } from "@/features/seat-categories/lib/escape-ilike";
import type {
  JobsQuery,
  JobsSortColumn,
} from "@/features/jobs/schemas/jobs-query.schema";
import type { JobStatus } from "@/features/jobs/lib/job-status";

export interface JobsQueryFilters {
  /** `ilike` pattern for `bookings.booking_number`, or `undefined`. */
  search_pattern: string | undefined;
  status: JobStatus | undefined;
  technician_id: string | undefined;
  sort: JobsSortColumn;
  order: "asc" | "desc";
  range: { from: number; to: number };
}

/** Pure — never imports Supabase; testable in isolation. */
export function buildJobsQueryFilters(query: JobsQuery): JobsQueryFilters {
  const { q, status, technician_id, sort, order, page, page_size } = query;

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  return {
    search_pattern: q ? `%${escapeIlikeValue(q)}%` : undefined,
    status,
    technician_id,
    sort,
    order,
    range: { from, to },
  };
}
