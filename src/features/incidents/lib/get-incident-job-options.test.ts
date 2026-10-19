import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  getIncidentJobOptions,
  INCIDENT_JOB_OPTIONS_LIMIT,
} from "@/features/incidents/lib/get-incident-job-options";

function mockQuery(result: { data: unknown; error: unknown }) {
  const limit = vi.fn().mockResolvedValue(result);
  const order2 = vi.fn(() => ({ limit }));
  const order1 = vi.fn(() => ({ order: order2 }));
  const neq = vi.fn(() => ({ order: order1 }));
  const select = vi.fn(() => ({ neq }));
  const from = vi.fn(() => ({ select }));
  createClientMock.mockResolvedValue({ from });
  return { from, select, neq, order1, limit };
}

describe("getIncidentJobOptions", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should map the jobs to options, newest first, capped, without cancelled jobs", async () => {
    const { from, neq, order1, limit } = mockQuery({
      data: [
        { id: "j-1", job_type: "inspection", booking: { booking_number: "BK-1" } },
        { id: "j-2", job_type: "cleaning", booking: null },
      ],
      error: null,
    });

    await expect(getIncidentJobOptions()).resolves.toEqual([
      { id: "j-1", job_type: "inspection", booking_number: "BK-1" },
      { id: "j-2", job_type: "cleaning", booking_number: "" },
    ]);
    expect(from).toHaveBeenCalledWith("technician_jobs");
    expect(neq).toHaveBeenCalledWith("status", "cancelled");
    expect(order1).toHaveBeenCalledWith("assigned_at", { ascending: false });
    expect(limit).toHaveBeenCalledWith(INCIDENT_JOB_OPTIONS_LIMIT);
  });

  it("should return an empty list when there are no jobs", async () => {
    mockQuery({ data: null, error: null });

    await expect(getIncidentJobOptions()).resolves.toEqual([]);
  });

  it("should throw when the query fails", async () => {
    mockQuery({ data: null, error: new Error("db down") });

    await expect(getIncidentJobOptions()).rejects.toThrow("db down");
  });
});
