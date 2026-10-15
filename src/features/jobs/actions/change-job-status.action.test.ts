import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

import { changeJobStatusAction } from "@/features/jobs/actions/change-job-status.action";

const VALID_INPUT = {
  job_id: "f0000000-0000-0000-0000-000000000002",
  from_status: "assigned",
  to_status: "in_progress",
};

describe("changeJobStatusAction", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ role: "technician" });
    rpcMock.mockReset();
  });

  it("should call the status function and return success", async () => {
    rpcMock.mockResolvedValue({ data: { id: "j-1" }, error: null });

    const result = await changeJobStatusAction(VALID_INPUT);

    expect(result).toEqual({ success: true });
    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "jobs:update_assigned",
      "technicians:manage",
    ]);
    expect(rpcMock).toHaveBeenCalledWith("change_technician_job_status", {
      p_job_id: VALID_INPUT.job_id,
      p_from_status: "assigned",
      p_to_status: "in_progress",
      p_reason: undefined,
    });
  });

  it("should pass the trimmed reason when cancelling", async () => {
    rpcMock.mockResolvedValue({ data: { id: "j-1" }, error: null });

    await changeJobStatusAction({
      ...VALID_INPUT,
      to_status: "cancelled",
      reason: "  No longer needed ",
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "change_technician_job_status",
      expect.objectContaining({ p_reason: "No longer needed" }),
    );
  });

  it("should drop a leftover reason when the target is not a cancel", async () => {
    rpcMock.mockResolvedValue({ data: { id: "j-1" }, error: null });

    await changeJobStatusAction({ ...VALID_INPUT, reason: "left over" });

    expect(rpcMock).toHaveBeenCalledWith(
      "change_technician_job_status",
      expect.objectContaining({ p_reason: undefined }),
    );
  });

  it("should return VALIDATION_ERROR and skip the call when a cancel has no reason", async () => {
    const result = await changeJobStatusAction({
      ...VALID_INPUT,
      to_status: "cancelled",
    });

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect when the caller lacks permission", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(changeJobStatusAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["55000", "INVALID_TRANSITION"],
    ["JB004", "STALE_DATA"],
    ["P0002", "NOT_FOUND"],
    ["42501", "FORBIDDEN"],
    ["XX000", "INTERNAL_ERROR"],
  ])("should map database error %s to %s", async (code, expected) => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code, message: "relation secret_table exploded" },
    });

    const result = await changeJobStatusAction(VALID_INPUT);

    expect(result.error?.code).toBe(expected);
    expect(result.error?.message).not.toContain("secret_table");
  });
});
