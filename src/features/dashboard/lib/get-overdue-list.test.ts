import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { getOverdueList, toOverdueList } from "@/features/dashboard/lib/get-overdue-list";

const NOW = new Date("2026-11-04T10:00:00Z");

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "job-1",
  job_number: "JOB-0001",
  job_type: "cleaning",
  status: "in_progress",
  deadline_at: "2026-11-04T08:00:00Z",
  booking: { airport: { timezone: "Asia/Dubai" } },
  ...overrides,
});

function mockRequest(result: { data: unknown; count: number | null; error: unknown }) {
  const request = {
    in: vi.fn(() => request),
    gte: vi.fn(() => request),
    lt: vi.fn(() => request),
    order: vi.fn(() => request),
    limit: vi.fn(() => request),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  createClientMock.mockResolvedValue({ from: vi.fn(() => ({ select: vi.fn(() => request) })) });
  return request;
}

describe("toOverdueList", () => {
  it("should give a link, the job type, the deadline in the airport zone and the status", () => {
    expect(toOverdueList([row()], 1)).toEqual({
      count: 1,
      items: [
        {
          id: "job-1",
          href: "/jobs/job-1",
          label: "JOB-0001 · Cleaning · 04 Nov 2026 12:00 GST",
          status_label: "In progress",
        },
      ],
    });
  });

  it("should give an empty list with a count of 0 when no job is overdue", () => {
    expect(toOverdueList([], 0)).toEqual({ count: 0, items: [] });
  });
});

describe("getOverdueList (VI-F11-S08, AC01)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should read the open jobs past their deadline, the longest overdue first, five at most", async () => {
    const request = mockRequest({ data: [row()], count: 9, error: null });

    const list = await getOverdueList(NOW);

    expect(request.in).toHaveBeenCalledWith("status", ["assigned", "in_progress"]);
    expect(request.lt).toHaveBeenCalledWith("deadline_at", NOW.toISOString());
    expect(request.order).toHaveBeenCalledWith("deadline_at", { ascending: true });
    expect(request.limit).toHaveBeenCalledWith(5);
    expect(list?.count).toBe(9);
  });

  it.each([
    ["the read returns an error", () => mockRequest({ data: null, count: null, error: { message: "x" } })],
    ["the client cannot be created", () => createClientMock.mockRejectedValue(new Error("no session"))],
  ])("should give null, not an empty list, when %s", async (_name, arrange) => {
    arrange();

    await expect(getOverdueList(NOW)).resolves.toBeNull();
  });
});
