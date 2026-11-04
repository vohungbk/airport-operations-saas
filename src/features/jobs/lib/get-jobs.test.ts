import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getJobs, JOB_LIST_SELECT } from "@/features/jobs/lib/get-jobs";
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

/** A query builder that records the filters and resolves like a Supabase request. */
function mockRequest(result: { data: unknown; error: unknown; count: number | null }) {
  const request = {
    ilike: vi.fn(() => request),
    eq: vi.fn(() => request),
    order: vi.fn(() => request),
    range: vi.fn(() => request),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  const select = vi.fn(() => request);
  const from = vi.fn(() => ({ select }));
  createClientMock.mockResolvedValue({ from });
  return { request, select, from };
}

describe("getJobs", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should select the job number with the job", async () => {
    const { select } = mockRequest({ data: [], error: null, count: 0 });

    await getJobs(BASE_QUERY);

    expect(select).toHaveBeenCalledWith(JOB_LIST_SELECT, { count: "exact" });
    expect(JOB_LIST_SELECT.split(", ")).toContain("job_number");
  });

  it("should find a job by its number when the search starts with job", async () => {
    const { request } = mockRequest({ data: [], error: null, count: 0 });

    await getJobs({ ...BASE_QUERY, q: "JOB-2026-000123" });

    expect(request.ilike).toHaveBeenCalledTimes(1);
    expect(request.ilike).toHaveBeenCalledWith("job_number", "%JOB-2026-000123%");
  });

  it("should keep searching the booking number for any other text", async () => {
    const { request } = mockRequest({ data: [], error: null, count: 0 });

    await getJobs({ ...BASE_QUERY, q: "BK-00021" });

    expect(request.ilike).toHaveBeenCalledWith("booking.booking_number", "%BK-00021%");
  });

  it("should not filter on a number when there is no search", async () => {
    const { request } = mockRequest({ data: [{ id: "j-1" }], error: null, count: 1 });

    const result = await getJobs(BASE_QUERY);

    expect(request.ilike).not.toHaveBeenCalled();
    expect(result).toEqual({ jobs: [{ id: "j-1" }], total: 1 });
  });

  it("should throw the database error", async () => {
    mockRequest({ data: null, error: new Error("boom"), count: null });

    await expect(getJobs(BASE_QUERY)).rejects.toThrow("boom");
  });
});
