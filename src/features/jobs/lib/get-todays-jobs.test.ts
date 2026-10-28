import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  getTodaysJobs,
  TODAYS_JOBS_SELECT,
} from "@/features/jobs/lib/get-todays-jobs";

const NOW = new Date("2026-10-28T10:00:00Z");

function mockQuery(result: { data: unknown; error: unknown }) {
  const inFilter = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ in: inFilter }));
  const from = vi.fn(() => ({ select }));
  createClientMock.mockResolvedValue({ from });
  return { from, select, inFilter };
}

describe("getTodaysJobs", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should read the open jobs of technician_jobs in one query and pick today's", async () => {
    const { from, inFilter } = mockQuery({
      data: [
        {
          id: "j1",
          status: "assigned",
          vehicle_bay: null,
          technician: null,
          booking: {
            booking_number: "BK-1",
            pickup_at: "2026-10-28T12:00:00Z",
            vehicle: null,
            vehicle_bay: null,
            airport: null,
            required_category: null,
            seat: null,
            flight: null,
          },
        },
      ],
      error: null,
    });

    const result = await getTodaysJobs(NOW);

    expect(from).toHaveBeenCalledWith("technician_jobs");
    expect(inFilter).toHaveBeenCalledWith("status", ["assigned", "in_progress"]);
    expect(result.jobs.map((job) => job.id)).toEqual(["j1"]);
  });

  it("should return no jobs when the viewer has none", async () => {
    mockQuery({ data: null, error: null });

    await expect(getTodaysJobs(NOW)).resolves.toEqual({
      jobs: [],
      next_pickup_at: null,
    });
  });

  it("should throw when the query fails, so the page shows its error and not an empty list", async () => {
    mockQuery({ data: null, error: new Error("db down") });

    await expect(getTodaysJobs(NOW)).rejects.toThrow("db down");
  });

  it("should never select pricing, revenue share, the partner or free-text booking notes", () => {
    for (const column of [
      "daily_rate",
      "paid_days",
      "gross_revenue",
      "partner_share",
      "platform_share",
      "partner_id",
      "external_booking_number",
      "notes",
    ]) {
      expect(TODAYS_JOBS_SELECT).not.toContain(column);
    }
  });
});
