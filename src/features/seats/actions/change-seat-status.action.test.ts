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

import { changeSeatStatusAction } from "@/features/seats/actions/change-seat-status.action";

const OPS_USER = {
  id: "user-1",
  email: "ops@example.com",
  full_name: "Ops User",
  role: "operations_manager" as const,
  partner_id: null,
  is_active: true,
};

const SEAT_ID = "e0000000-0000-4000-8000-000000000001";

describe("changeSeatStatusAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(OPS_USER);
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: {}, error: null });
    fromMock.mockClear();
  });

  it("should call the change_seat_status RPC with the seat, target and trimmed reason on success", async () => {
    const result = await changeSeatStatusAction({
      seat_id: SEAT_ID,
      to_status: "quarantine",
      reason: "  Cracked shell  ",
    });

    expect(result).toEqual({ success: true });
    expect(requirePermissionMock).toHaveBeenCalledWith("seats:manage");
    expect(rpcMock).toHaveBeenCalledWith("change_seat_status", {
      p_seat_id: SEAT_ID,
      p_to_status: "quarantine",
      p_reason: "Cracked shell",
    });
  });

  it("should send an empty reason when none is given for a non-quarantine target", async () => {
    await changeSeatStatusAction({ seat_id: SEAT_ID, to_status: "available" });

    expect(rpcMock).toHaveBeenCalledWith("change_seat_status", {
      p_seat_id: SEAT_ID,
      p_to_status: "available",
      p_reason: "",
    });
  });

  it("should never update seats directly (status changes go only through the RPC)", async () => {
    await changeSeatStatusAction({ seat_id: SEAT_ID, to_status: "retired" });

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error without calling the RPC when quarantine has no reason", async () => {
    const result = await changeSeatStatusAction({
      seat_id: SEAT_ID,
      to_status: "quarantine",
      reason: "   ",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should reject an operational status as target without calling the RPC", async () => {
    const result = await changeSeatStatusAction({
      seat_id: SEAT_ID,
      to_status: "in_use",
    });

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should reject a malformed seat id without calling the RPC", async () => {
    const result = await changeSeatStatusAction({
      seat_id: "nope",
      to_status: "retired",
    });

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["P0002", "NOT_FOUND"],
    ["55000", "INVALID_TRANSITION"],
    ["22023", "VALIDATION_ERROR"],
    ["42501", "FORBIDDEN"],
    ["XX000", "INTERNAL_ERROR"],
  ])("should map RPC error %s to %s", async (pgCode, actionCode) => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: pgCode, message: "raw database message" },
    });

    const result = await changeSeatStatusAction({
      seat_id: SEAT_ID,
      to_status: "retired",
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(actionCode);
    expect(result.error?.message).not.toContain("raw database message");
  });

  it("should propagate the permission guard's redirect and never call the RPC when unauthorized", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      changeSeatStatusAction({ seat_id: SEAT_ID, to_status: "retired" }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
