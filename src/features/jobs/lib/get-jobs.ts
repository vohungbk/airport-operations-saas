import { createClient } from "@/lib/supabase/server";
import { nextDay, zonedDayStart } from "@/features/jobs/lib/job-time";
import { applyJobDeadlineFilter } from "@/features/jobs/lib/job-deadline";
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
 * the job rows themselves. A search that starts with "job" filters on the
 * job number instead (PostgREST cannot OR a column of the job with one of
 * the booking); one that starts with "seat" finds the seat ids first and filters the bookings by them.
 */
export const JOB_LIST_SELECT =
  "id, job_number, job_type, status, assigned_at, started_at, completed_at, vehicle_bay, deadline_at, booking:bookings!inner(id, booking_number, airport:airports(timezone), seat:seats!assigned_seat_id(id, serial_number)), technician:users!technician_id(id, full_name)";

/**
 * Server-only. RLS is the access boundary: admin/ops read every job, a
 * technician reads only their own. The filters here are only for the
 * page's search/filter/sort/pagination UI.
 */
export async function getJobs(
  query: JobsQuery,
  now: Date = new Date(),
  /** The zone the From and To days of the date range are read in. */
  timeZone = "UTC",
): Promise<GetJobsResult> {
  const filters = buildJobsQueryFilters(query);
  const supabase = await createClient();

  let request = supabase
    .from("technician_jobs")
    .select(JOB_LIST_SELECT, { count: "exact" })
    .order(filters.sort, { ascending: filters.order === "asc" })
    // Unique tie-breaker so ties never repeat or skip rows across pages.
    .order("id", { ascending: true })
    .range(filters.range.from, filters.range.to);

  if (filters.search_pattern && filters.search_field === "seat_number") {
    const { data: seats, error: seatError } = await supabase
      .from("seats")
      .select("id")
      .ilike("serial_number", filters.search_pattern);

    if (seatError) {
      throw seatError;
    }

    if (!seats || seats.length === 0) {
      return { jobs: [], total: 0 };
    }

    request = request.in(
      "booking.assigned_seat_id",
      seats.map((seat) => seat.id),
    );
  } else if (filters.search_pattern) {
    request = request.ilike(
      filters.search_field === "job_number" ? "job_number" : "booking.booking_number",
      filters.search_pattern,
    );
  }

  if (filters.type) {
    request = request.eq("job_type", filters.type);
  }

  if (filters.airport_id) {
    request = request.eq("booking.airport_id", filters.airport_id);
  }

  if (filters.unassigned) {
    request = request.is("technician_id", null);
  }

  if (query.from) {
    request = request.gte("deadline_at", zonedDayStart(query.from, timeZone));
  }

  if (query.to) {
    request = request.lt("deadline_at", zonedDayStart(nextDay(query.to), timeZone));
  }

  if (filters.status) {
    request = request.eq("status", filters.status);
  }

  if (filters.technician_id) {
    request = request.eq("technician_id", filters.technician_id);
  }

  if (query.deadline) {
    request = applyJobDeadlineFilter(request, query.deadline, now);
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
