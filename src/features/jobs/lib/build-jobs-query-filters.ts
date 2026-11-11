import { escapeIlikeValue } from "@/features/seat-categories/lib/escape-ilike";
import type {
  JobsQuery,
  JobsSortColumn,
} from "@/features/jobs/schemas/jobs-query.schema";
import type { JobStatus } from "@/features/jobs/lib/job-status";
import type { JobType } from "@/features/jobs/lib/job-type";

/** What the search text is matched against. */
export type JobsSearchField = "job_number" | "seat_number" | "booking_number";

/** A search that starts with "job" is a job number (`JOB-2026-000123`), one that starts with "seat" a seat; anything else is a booking number. */
const JOB_NUMBER_SEARCH = /^job/i;
const SEAT_NUMBER_SEARCH = /^seat/i;

export interface JobsQueryFilters {
  /** `ilike` pattern for the field in `search_field`, or `undefined`. */
  search_pattern: string | undefined;
  search_field: JobsSearchField;
  status: JobStatus | undefined;
  technician_id: string | undefined;
  type: JobType | undefined;
  airport_id: string | undefined;
  unassigned: boolean;
  sort: JobsSortColumn;
  order: "asc" | "desc";
  range: { from: number; to: number };
}

/** Pure — never imports Supabase; testable in isolation. */
export function buildJobsQueryFilters(query: JobsQuery): JobsQueryFilters {
  const { q, status, technician_id, type, airport_id, unassigned, sort, order, page, page_size } = query;

  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  return {
    search_pattern: q ? `%${escapeIlikeValue(q)}%` : undefined,
    search_field: !q
      ? "booking_number"
      : JOB_NUMBER_SEARCH.test(q)
        ? "job_number"
        : SEAT_NUMBER_SEARCH.test(q)
          ? "seat_number"
          : "booking_number",
    status,
    technician_id,
    type,
    airport_id,
    unassigned: unassigned === "1",
    sort,
    order,
    range: { from, to },
  };
}
