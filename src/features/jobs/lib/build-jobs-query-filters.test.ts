import { describe, expect, it } from "vitest";

import { buildJobsQueryFilters } from "@/features/jobs/lib/build-jobs-query-filters";
import type { JobsQuery } from "@/features/jobs/schemas/jobs-query.schema";

const BASE_QUERY: JobsQuery = {
  q: undefined,
  status: undefined,
  technician_id: undefined,
  sort: "assigned_at",
  order: "desc",
  page: 1,
  page_size: 20,
};

describe("buildJobsQueryFilters", () => {
  it("should leave search undefined when q is not provided", () => {
    expect(buildJobsQueryFilters(BASE_QUERY).search_pattern).toBeUndefined();
  });

  it("should build a contains pattern from q", () => {
    expect(
      buildJobsQueryFilters({ ...BASE_QUERY, q: "BK-001" }).search_pattern,
    ).toBe("%BK-001%");
  });

  it("should match ilike wildcards literally", () => {
    expect(
      buildJobsQueryFilters({ ...BASE_QUERY, q: "50%_" }).search_pattern,
    ).toBe("%50\\%\\_%");
  });

  it("should search the job number when the search starts with job, in any case", () => {
    for (const q of ["JOB-2026-000123", "job-2026", "Job"]) {
      expect(buildJobsQueryFilters({ ...BASE_QUERY, q }).search_field, q).toBe("job_number");
    }
  });

  it("should search the booking number for anything else, and by default", () => {
    for (const q of ["BK-001", "000123", "2026", "xjob"]) {
      expect(buildJobsQueryFilters({ ...BASE_QUERY, q }).search_field, q).toBe("booking_number");
    }
    expect(buildJobsQueryFilters(BASE_QUERY).search_field).toBe("booking_number");
  });

  it("should search the seat when the search starts with seat, in any case", () => {
    for (const q of ["SEAT-0001", "seat-00", "Seat"]) {
      expect(buildJobsQueryFilters({ ...BASE_QUERY, q }).search_field, q).toBe("seat_number");
    }
  });

  it("should pass the type, the airport and the unassigned chip through", () => {
    const result = buildJobsQueryFilters({
      ...BASE_QUERY,
      type: "cleaning",
      airport_id: "a0000000-0000-0000-0000-000000000001",
      unassigned: "1",
    });

    expect(result.type).toBe("cleaning");
    expect(result.airport_id).toBe("a0000000-0000-0000-0000-000000000001");
    expect(result.unassigned).toBe(true);
    expect(buildJobsQueryFilters(BASE_QUERY).unassigned).toBe(false);
  });

  it("should pass status and technician filters through", () => {
    const result = buildJobsQueryFilters({
      ...BASE_QUERY,
      status: "assigned",
      technician_id: "d0000000-0000-0000-0000-000000000001",
    });

    expect(result.status).toBe("assigned");
    expect(result.technician_id).toBe("d0000000-0000-0000-0000-000000000001");
  });

  it("should compute the range from page and page size", () => {
    expect(
      buildJobsQueryFilters({ ...BASE_QUERY, page: 3, page_size: 10 }).range,
    ).toEqual({ from: 20, to: 29 });
  });
});
