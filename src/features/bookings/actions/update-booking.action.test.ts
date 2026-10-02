import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn(() => ({ maybeSingle: maybeSingleMock })));
const selectMock = vi.hoisted(() => vi.fn(() => ({ eq: eqMock })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ select: selectMock })));

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock, from: fromMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { updateBookingAction } from "@/features/bookings/actions/update-booking.action";

const BOOKING_ID = "f0000000-0000-4000-8000-000000000001";

const VALID_INPUT = {
  expected_updated_at: "2026-09-01T04:00:00.123456+00:00",
  pickup_at: "2026-09-01T08:00",
  return_at: "2026-09-02T08:00",
};

describe("updateBookingAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ role: "operations_manager" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: { id: BOOKING_ID }, error: null });
    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({
      data: { id: BOOKING_ID, airport_id: "a1", airport: { timezone: "Asia/Dubai" } },
      error: null,
    });
  });

  it("should call update_booking with expected_updated_at and redirect to the detail page", async () => {
    await expect(updateBookingAction(BOOKING_ID, VALID_INPUT)).rejects.toThrow(
      `REDIRECT:/bookings/${BOOKING_ID}`,
    );

    expect(requirePermissionMock).toHaveBeenCalledWith("bookings:manage");
    expect(rpcMock).toHaveBeenCalledWith(
      "update_booking",
      expect.objectContaining({
        p_booking_id: BOOKING_ID,
        p_expected_updated_at: VALID_INPUT.expected_updated_at,
        p_pickup_at: "2026-09-01T04:00:00.000Z",
      }),
    );
  });

  it("should never send status, partner or rate to the RPC even if the client sends them", async () => {
    await expect(
      updateBookingAction(BOOKING_ID, {
        ...VALID_INPUT,
        status: "completed",
        partner_id: "b0000000-0000-0000-0000-000000000002",
        daily_rate: "1",
      }),
    ).rejects.toThrow("REDIRECT");

    const args = rpcMock.mock.calls[0][1];
    for (const key of ["p_status", "p_partner_id", "p_daily_rate"]) {
      expect(args).not.toHaveProperty(key);
    }
  });

  it("should return a validation error for a malformed booking id", async () => {
    const result = await updateBookingAction("nope", VALID_INPUT);

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should return a validation error when return is before pickup", async () => {
    const result = await updateBookingAction(BOOKING_ID, {
      ...VALID_INPUT,
      return_at: "2026-08-01T08:00",
    });

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should return NOT_FOUND when the booking is missing or hidden by RLS", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await updateBookingAction(BOOKING_ID, VALID_INPUT);

    expect(result.error?.code).toBe("NOT_FOUND");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should return a clear NOT_FOUND error when the airport is hidden or missing", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: BOOKING_ID, airport_id: "a1", airport: null },
      error: null,
    });

    const result = await updateBookingAction(BOOKING_ID, VALID_INPUT);

    expect(result.error?.code).toBe("NOT_FOUND");
    expect(result.error?.message).toContain("Airport");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should map a stale expected_updated_at to STALE_DATA", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "BK004", message: "x" } });

    const result = await updateBookingAction(BOOKING_ID, VALID_INPUT);

    expect(result.error?.code).toBe("STALE_DATA");
  });

  it("should map editing a terminal booking to INVALID_TRANSITION", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "55000", message: "x" } });

    const result = await updateBookingAction(BOOKING_ID, VALID_INPUT);

    expect(result.error?.code).toBe("INVALID_TRANSITION");
  });

  it("should propagate the guard's redirect for a user without bookings:manage", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(updateBookingAction(BOOKING_ID, VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
