import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock, from: fromMock })),
}));

import { changeBookingStatusAction } from "@/features/bookings/actions/change-booking-status.action";

const BOOKING_ID = "f0000000-0000-4000-8000-000000000001";

function currentStatusIs(status: string | null) {
  maybeSingleMock.mockResolvedValue({ data: status ? { status } : null, error: null });
}

describe("changeBookingStatusAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ role: "operations_manager" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: {}, error: null });
    updateMock.mockReset();
    maybeSingleMock.mockReset();
    currentStatusIs("pending");
    fromMock.mockReset();
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
      update: updateMock,
    });
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

  it.each(["assigned", "in_progress"] as const)(
    "should call change_booking_status to cancel a booking that is %s",
    async (status) => {
      currentStatusIs(status);

      const result = await changeBookingStatusAction({
        booking_id: BOOKING_ID,
        to_status: "cancelled",
        reason: "Flight cancelled",
      });

      expect(result).toEqual({ success: true });
      expect(rpcMock).toHaveBeenCalledWith("change_booking_status", {
        p_booking_id: BOOKING_ID,
        p_to_status: "cancelled",
        p_reason: "Flight cancelled",
      });
    },
  );

  it("should reject cancelling a booking that is already completed, without calling the RPC", async () => {
    currentStatusIs("completed");

    const result = await changeBookingStatusAction({
      booking_id: BOOKING_ID,
      to_status: "cancelled",
      reason: "Too late",
    });

    expect(result.error?.code).toBe("INVALID_TRANSITION");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should never update bookings directly (status changes go only through the RPC)", async () => {
    await changeBookingStatusAction({
      booking_id: BOOKING_ID,
      to_status: "confirmed",
    });

    expect(updateMock).not.toHaveBeenCalled();
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

  it("should reject a skipped step with a message that names the steps that come first", async () => {
    const result = await changeBookingStatusAction({
      booking_id: BOOKING_ID,
      to_status: "completed",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "INVALID_TRANSITION",
        message:
          "Cannot move a booking from Pending to Completed. Confirmed, Assigned and In progress come first.",
      },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should say that a step of the operations workflow is not set by hand", async () => {
    currentStatusIs("confirmed");

    const result = await changeBookingStatusAction({
      booking_id: BOOKING_ID,
      to_status: "assigned",
    });

    expect(result.error).toEqual({
      code: "INVALID_TRANSITION",
      message: "Assigned is set by the operations workflow, not by hand.",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["in_progress", "assigned", "A booking cannot move back from In progress to Assigned."],
    ["completed", "in_progress", "A booking cannot move back from Completed to In progress."],
  ] as const)(
    "should reject a step back from %s to %s and not call the RPC (CO-F08-S05 AC01)",
    async (from, to, message) => {
      currentStatusIs(from);

      const result = await changeBookingStatusAction({ booking_id: BOOKING_ID, to_status: to });

      expect(result).toEqual({ success: false, error: { code: "INVALID_TRANSITION", message } });
      expect(rpcMock).not.toHaveBeenCalled();
    },
  );

  it("should reject a change out of a status the booking cannot leave", async () => {
    currentStatusIs("cancelled");

    const result = await changeBookingStatusAction({
      booking_id: BOOKING_ID,
      to_status: "confirmed",
    });

    expect(result.error?.code).toBe("INVALID_TRANSITION");
    expect(result.error?.message).toBe("A booking that is Cancelled cannot move to Confirmed.");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should map a failed read of the booking, and not call the RPC", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { code: "42501", message: "x" } });

    const result = await changeBookingStatusAction({
      booking_id: BOOKING_ID,
      to_status: "confirmed",
    });

    expect(result.error?.code).toBe("FORBIDDEN");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should return not found, without calling the RPC, when the booking does not exist or is hidden", async () => {
    currentStatusIs(null);

    const result = await changeBookingStatusAction({
      booking_id: BOOKING_ID,
      to_status: "confirmed",
    });

    expect(result.error?.code).toBe("NOT_FOUND");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should map an invalid transition from the RPC to INVALID_TRANSITION (the database has the last word)", async () => {
    currentStatusIs("confirmed");
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
