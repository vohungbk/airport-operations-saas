import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  getTechnicianAssignments,
  toTechnicianAssignmentList,
} from "@/features/dashboard/lib/get-technician-assignments";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "job-1",
  job_number: "JOB-0001",
  job_type: "cleaning",
  status: "in_progress",
  deadline_at: "2026-11-04T08:00:00Z",
  technician: { full_name: "Amina Khan" },
  booking: { airport: { timezone: "Asia/Dubai" } },
  ...overrides,
});

function mockRequest(result: { data: unknown; count: number | null; error: unknown }) {
  const request = {
    in: vi.fn(() => request),
    order: vi.fn(() => request),
    limit: vi.fn(() => request),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  createClientMock.mockResolvedValue({ from: vi.fn(() => ({ select: vi.fn(() => request) })) });
  return request;
}

describe("toTechnicianAssignmentList", () => {
  it("should give the technician, the job, the deadline in the airport zone and the status", () => {
    expect(toTechnicianAssignmentList([row()], 1)).toEqual({
      count: 1,
      items: [
        {
          id: "job-1",
          href: "/jobs/job-1",
          label: "Amina Khan · JOB-0001 · Cleaning · 04 Nov 2026 12:00 GST",
          status_label: "In progress",
        },
      ],
    });
  });

  it("should leave out the deadline of a job that has none", () => {
    const [item] = toTechnicianAssignmentList([row({ deadline_at: null })], 1).items;

    expect(item.label).toBe("Amina Khan · JOB-0001 · Cleaning");
  });

  it("should give an empty list with a count of 0 when no job is open", () => {
    expect(toTechnicianAssignmentList([], 0)).toEqual({ count: 0, items: [] });
  });
});

describe("getTechnicianAssignments (VI-F11-S07, AC01)", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should read the open jobs, the nearest deadline first, five at most", async () => {
    const request = mockRequest({ data: [row()], count: 8, error: null });

    const list = await getTechnicianAssignments();

    expect(request.in).toHaveBeenCalledWith("status", ["assigned", "in_progress"]);
    expect(request.order).toHaveBeenCalledWith("deadline_at", { ascending: true, nullsFirst: false });
    expect(request.limit).toHaveBeenCalledWith(5);
    expect(list?.count).toBe(8);
  });

  it.each([
    ["the read returns an error", () => mockRequest({ data: null, count: null, error: { message: "x" } })],
    ["the client cannot be created", () => createClientMock.mockRejectedValue(new Error("no session"))],
  ])("should give null, not an empty list, when %s", async (_name, arrange) => {
    arrange();

    await expect(getTechnicianAssignments()).resolves.toBeNull();
  });
});
