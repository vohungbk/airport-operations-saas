import { createClient } from "@/lib/supabase/server";
import { buildJobsQueryFilters } from "@/features/jobs/lib/build-jobs-query-filters";
import type { JobsQuery } from "@/features/jobs/schemas/jobs-query.schema";
import type { JobListItem } from "@/features/jobs/types";

export interface GetJobsResult {
  jobs: JobListItem[];
  total: number;
}

/**
 * One nested select (job + booking + technician) — never a per-row
 * lookup. `booking` is `!inner` so the booking-number search can filter
 * the job rows themselves.
 */
export const JOB_LIST_SELECT =
  "id, status, assigned_at, started_at, completed_at, vehicle_bay, booking:bookings!inner(id, booking_number), technician:users!technician_id(id, full_name)";

/**
 * Server-only. RLS is the access boundary: admin/ops read every job, a
 * technician reads only their own. The filters here are only for the
 * page's search/filter/sort/pagination UI.
 */
export async function getJobs(query: JobsQuery): Promise<GetJobsResult> {
  const filters = buildJobsQueryFilters(query);
  const supabase = await createClient();

  let request = supabase
    .from("technician_jobs")
    .select(JOB_LIST_SELECT, { count: "exact" })
    .order(filters.sort, { ascending: filters.order === "asc" })
    // Unique tie-breaker so ties never repeat or skip rows across pages.
    .order("id", { ascending: true })
    .range(filters.range.from, filters.range.to);

  if (filters.search_pattern) {
    request = request.ilike("booking.booking_number", filters.search_pattern);
  }

  if (filters.status) {
    request = request.eq("status", filters.status);
  }

  if (filters.technician_id) {
    request = request.eq("technician_id", filters.technician_id);
  }

  const { data, error, count } = await request;

  if (error) {
    throw error;
  }

  return {
    jobs: (data ?? []) as unknown as JobListItem[],
    total: count ?? 0,
  };
}
