import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock, from: fromMock })),
}));

import { changeBookingStatusAction } from "@/features/bookings/actions/change-booking-status.action";

const BOOKING_ID = "f0000000-0000-4000-8000-000000000001";

describe("changeBookingStatusAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ role: "operations_manager" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: {}, error: null });
    fromMock.mockClear();
  });

  it("should call change_booking_status with the target and trimmed reason on success", async () => {
    const result = await changeBookingStatusAction({
      booking_id: BOOKING_ID,
      to_status: "cancelled",
      reason: "  Customer called  ",
    });

    expect(result).toEqual({ success: true });
    expect(requirePermissionMock).toHaveBeenCalledWith("bookings:manage");
    expect(rpcMock).toHaveBeenCalledWith("change_booking_status", {
      p_booking_id: BOOKING_ID,
      p_to_status: "cancelled",
      p_reason: "Customer called",
    });
  });

  it("should never update bookings directly (status changes go only through the RPC)", async () => {
    await changeBookingStatusAction({
      booking_id: BOOKING_ID,
      to_status: "confirmed",
    });

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error without calling the RPC when cancelling without a reason", async () => {
    const result = await changeBookingStatusAction({
      booking_id: BOOKING_ID,
      to_status: "cancelled",
      reason: "  ",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should reject a workflow-owned target status", async () => {
    const result = await changeBookingStatusAction({
      booking_id: BOOKING_ID,
      to_status: "completed",
      reason: "x",
    });

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should map an invalid transition from the RPC to INVALID_TRANSITION", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "55000", message: "x" } });

    const result = await changeBookingStatusAction({
      booking_id: BOOKING_ID,
      to_status: "no_show",
      reason: "x",
    });

    expect(result.error?.code).toBe("INVALID_TRANSITION");
  });

  it("should propagate the guard's redirect for a user without bookings:manage", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      changeBookingStatusAction({ booking_id: BOOKING_ID, to_status: "confirmed" }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
