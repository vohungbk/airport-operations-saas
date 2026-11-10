import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const getAirportTimezoneMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

vi.mock("@/features/bookings/lib/get-airport-timezone", () => ({
  getAirportTimezone: getAirportTimezoneMock,
}));

import { getAvailableSeatsAction } from "@/features/bookings/actions/get-available-seats.action";

const INPUT = {
  airport_id: "a0000000-0000-0000-0000-000000000001",
  seat_category_id: "c0000000-0000-0000-0000-000000000001",
  pickup_at: "2026-09-01T08:00",
  return_at: "2026-09-04T08:00",
};

describe("getAvailableSeatsAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ role: "operations_manager" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({
      data: [
        {
          id: "s1",
          serial_number: "SEAT-0001",
          availability: "available",
          conflict_booking_number: null,
          unusable_reason: null,
        },
        {
          id: "s2",
          serial_number: "SEAT-0002",
          availability: "conflict",
          conflict_booking_number: "BK-2026-000123",
          unusable_reason: null,
        },
        {
          id: "s3",
          serial_number: "SEAT-0003",
          availability: "not_usable",
          conflict_booking_number: null,
          unusable_reason: "Seat status: cleaning",
        },
      ],
      error: null,
    });
    getAirportTimezoneMock.mockReset();
    getAirportTimezoneMock.mockResolvedValue({ timezone: "Asia/Dubai" });
  });

  it("should return every seat with its state from get_booking_seat_options using UTC times", async () => {
    const result = await getAvailableSeatsAction(INPUT);

    expect(result.success).toBe(true);
    expect(result.seats?.map((seat) => seat.availability)).toEqual([
      "available",
      "conflict",
      "not_usable",
    ]);
    expect(result.seats?.[1].conflict_booking_number).toBe("BK-2026-000123");
    expect(result.seats?.[2].unusable_reason).toBe("Seat status: cleaning");
    expect(rpcMock).toHaveBeenCalledWith(
      "get_booking_seat_options",
      expect.objectContaining({ p_pickup_at: "2026-09-01T04:00:00.000Z" }),
    );
  });

  it("should reject a return time before the pickup time without calling the RPC", async () => {
    const result = await getAvailableSeatsAction({
      ...INPUT,
      return_at: "2026-08-01T08:00",
    });

    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect for a user without bookings:manage", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(getAvailableSeatsAction(INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
  });
});
