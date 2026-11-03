import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

import { moveBookingAction } from "@/features/bookings/actions/move-booking.action";

const BOOKING_ID = "f0000000-0000-4000-8000-000000000001";

describe("moveBookingAction", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ role: "operations_manager" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: {}, error: null });
  });

  it("should move the booking with the step the person saw and a trimmed note (AC01)", async () => {
    const result = await moveBookingAction({
      booking_id: BOOKING_ID,
      expected_status: "confirmed",
      note: "  Seat checked  ",
    });

    expect(result).toEqual({ success: true, moved_to: "preparation" });
    expect(rpcMock).toHaveBeenCalledWith("move_booking_to_next_step", {
      p_booking_id: BOOKING_ID,
      p_expected_status: "confirmed",
      p_note: "Seat checked",
    });
  });

  it("should leave out the note when there is none", async () => {
    await moveBookingAction({ booking_id: BOOKING_ID, expected_status: "pending" });

    expect(rpcMock).toHaveBeenCalledWith("move_booking_to_next_step", {
      p_booking_id: BOOKING_ID,
      p_expected_status: "pending",
      p_note: undefined,
    });
  });

  it("should check that the person may move bookings at all", async () => {
    await moveBookingAction({ booking_id: BOOKING_ID, expected_status: "pending" });

    expect(requireAnyPermissionMock).toHaveBeenCalledWith(["jobs:update_assigned", "technicians:manage"]);
  });

  it("should propagate the guard's redirect for a role that may not move bookings", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      moveBookingAction({ booking_id: BOOKING_ID, expected_status: "pending" }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should return a validation error, without calling the function, for input that is not valid", async () => {
    const result = await moveBookingAction({ booking_id: "BK-1", expected_status: "pending" });

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should refuse a booking at the last step, which has no next step", async () => {
    const result = await moveBookingAction({ booking_id: BOOKING_ID, expected_status: "completed" });

    expect(result.error).toEqual({ code: "INVALID_TRANSITION", message: "This booking has no next step." });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should show the current step when another user moved the booking first (AC03)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "BK007", details: "assigned", message: "x" } });

    const result = await moveBookingAction({ booking_id: BOOKING_ID, expected_status: "confirmed" });

    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({
      code: "STEP_CHANGED",
      message: "Another user moved this booking. It is now in Technician Assigned.",
      current_step: "assigned",
    });
  });

  it("should name the step in the message when the role is not allowed (AC02)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "42501", details: null, message: "x" } });

    const result = await moveBookingAction({ booking_id: BOOKING_ID, expected_status: "confirmed" });

    expect(result.error?.message).toBe("Your role is not allowed to move this booking to Preparation.");
  });
});
