import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import {
  BOOKING_ADJUSTMENTS_LIMIT,
  BOOKING_ADJUSTMENTS_SELECT,
  getBookingAdjustments,
} from "@/features/bookings/lib/get-booking-adjustments";

const BOOKING_ID = "f0000000-0000-0000-0000-000000000025";

function mockQuery(result: { data: unknown; error: unknown }) {
  const limit = vi.fn().mockResolvedValue(result);
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  createClientMock.mockResolvedValue({ from });
  return { from, select, eq, order, limit };
}

describe("getBookingAdjustments", () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it("should return an empty list without querying when the id is malformed", async () => {
    await expect(getBookingAdjustments("not-an-id")).resolves.toEqual([]);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("should read the adjustments of one booking, newest first, in one query", async () => {
    const q = mockQuery({ data: [], error: null });

    await getBookingAdjustments(BOOKING_ID);

    expect(q.from).toHaveBeenCalledWith("booking_adjustments");
    expect(q.select).toHaveBeenCalledWith(BOOKING_ADJUSTMENTS_SELECT);
    expect(q.eq).toHaveBeenCalledWith("booking_id", BOOKING_ID);
    expect(q.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(q.limit).toHaveBeenCalledWith(BOOKING_ADJUSTMENTS_LIMIT);
  });

  it("should return the rows, and an empty list when RLS hides them", async () => {
    const rows = [{ id: "a-1", type: "chargeback", amount: 20, reason: "x", created_at: "2026-10-24T10:00:00Z" }];
    mockQuery({ data: rows, error: null });
    await expect(getBookingAdjustments(BOOKING_ID)).resolves.toEqual(rows);

    mockQuery({ data: null, error: null });
    await expect(getBookingAdjustments(BOOKING_ID)).resolves.toEqual([]);
  });

  it("should throw when the query fails", async () => {
    mockQuery({ data: null, error: new Error("db down") });

    await expect(getBookingAdjustments(BOOKING_ID)).rejects.toThrow("db down");
  });

  it("should not select who recorded it", () => {
    expect(BOOKING_ADJUSTMENTS_SELECT).not.toContain("created_by");
  });
});
