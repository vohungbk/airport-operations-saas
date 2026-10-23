import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  getCleaningJobsForSeat,
  SEAT_CLEANING_JOBS_SELECT,
} from "@/features/cleaning/lib/get-cleaning-jobs-for-seat";

const SEAT_ID = "e0000000-0000-0000-0000-000000000008";

function mockQuery(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const eqSeat = vi.fn(() => ({ order }));
  const inStatus = vi.fn(() => ({ eq: eqSeat }));
  const eqType = vi.fn(() => ({ in: inStatus }));
  const select = vi.fn(() => ({ eq: eqType }));
  const from = vi.fn(() => ({ select }));
  createClientMock.mockResolvedValue({ from });
  return { from, select, eqType, inStatus, eqSeat, order };
}

describe("getCleaningJobsForSeat", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should return an empty list without querying when the seat id is malformed", async () => {
    await expect(getCleaningJobsForSeat("not-an-id")).resolves.toEqual([]);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("should ask only for open cleaning jobs of the seat, oldest first, in one query", async () => {
    const q = mockQuery({ data: [], error: null });

    await getCleaningJobsForSeat(SEAT_ID);

    expect(q.from).toHaveBeenCalledTimes(1);
    expect(q.from).toHaveBeenCalledWith("technician_jobs");
    expect(q.eqType).toHaveBeenCalledWith("job_type", "cleaning");
    expect(q.inStatus).toHaveBeenCalledWith("status", ["assigned", "in_progress"]);
    expect(q.eqSeat).toHaveBeenCalledWith("booking.assigned_seat_id", SEAT_ID);
    expect(q.order).toHaveBeenCalledWith("assigned_at", { ascending: true });
  });

  it("should map the rows to jobs", async () => {
    mockQuery({
      data: [
        {
          id: "j-1",
          status: "assigned",
          assigned_at: "2026-10-23T08:00:00Z",
          booking: { booking_number: "BK-00002" },
        },
      ],
      error: null,
    });

    await expect(getCleaningJobsForSeat(SEAT_ID)).resolves.toEqual([
      {
        id: "j-1",
        status: "assigned",
        assigned_at: "2026-10-23T08:00:00Z",
        booking_number: "BK-00002",
      },
    ]);
  });

  it("should return an empty list when RLS hides every job", async () => {
    mockQuery({ data: null, error: null });

    await expect(getCleaningJobsForSeat(SEAT_ID)).resolves.toEqual([]);
  });

  it("should throw when the query fails", async () => {
    mockQuery({ data: null, error: new Error("db down") });

    await expect(getCleaningJobsForSeat(SEAT_ID)).rejects.toThrow("db down");
  });

  it("should never select pricing, partner or free-text columns", () => {
    for (const column of ["daily_rate", "partner", "notes", "customer"]) {
      expect(SEAT_CLEANING_JOBS_SELECT).not.toContain(column);
    }
  });
});
