import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getOverdueJobsCount } from "@/features/dashboard/lib/get-overdue-jobs";
import { getJobs } from "@/features/jobs/lib/get-jobs";

const NOW = new Date("2026-11-04T10:00:00Z");

function mockRequest(result: { count: number | null; error: unknown }) {
  const request = {
    in: vi.fn(() => request),
    gte: vi.fn(() => request),
    lt: vi.fn(() => request),
    // Only the list uses these.
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

describe("getOverdueJobsCount (UI-F06-T01, AC05)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should count the open jobs past their deadline with the rule of the Overdue chip", async () => {
    const { request, from, select } = mockRequest({ count: 3, error: null });

    await expect(getOverdueJobsCount(NOW)).resolves.toBe(3);

    expect(from).toHaveBeenCalledWith("technician_jobs");
    expect(select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(request.in).toHaveBeenCalledWith("status", ["assigned", "in_progress"]);
    expect(request.lt).toHaveBeenCalledWith("deadline_at", NOW.toISOString());
  });

  it("should apply the same conditions as the Overdue chip of the jobs list, so the figure matches the list", async () => {
    const tile = mockRequest({ count: 3, error: null });
    await getOverdueJobsCount(NOW);

    const list = mockRequest({ count: 3, error: null });
    await getJobs(
      { sort: "assigned_at", order: "desc", page: 1, page_size: 20, deadline: "overdue" },
      NOW,
    );

    expect(list.request.in.mock.calls).toEqual(tile.request.in.mock.calls);
    expect(list.request.lt.mock.calls).toEqual(tile.request.lt.mock.calls);
    expect(list.request.gte.mock.calls).toEqual(tile.request.gte.mock.calls);
  });

  it("should give 0 when no job is overdue", async () => {
    mockRequest({ count: 0, error: null });

    await expect(getOverdueJobsCount(NOW)).resolves.toBe(0);
  });

  it("should give null, not 0, when the read fails", async () => {
    mockRequest({ count: null, error: { message: "boom" } });

    await expect(getOverdueJobsCount(NOW)).resolves.toBeNull();
  });

  it("should give null when the client cannot be made", async () => {
    createClientMock.mockImplementation(async () => {
      throw new Error("no session");
    });

    await expect(getOverdueJobsCount(NOW)).resolves.toBeNull();
  });
});
