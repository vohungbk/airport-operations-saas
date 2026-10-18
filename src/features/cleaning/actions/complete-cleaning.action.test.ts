import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { completeCleaningAction } from "@/features/cleaning/actions/complete-cleaning.action";

const JOB_ID = "f0000000-0000-0000-0000-000000000002";

describe("completeCleaningAction", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "technician" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ error: null });
  });

  it("should complete as passed and go back to the job", async () => {
    await expect(
      completeCleaningAction({ job_id: JOB_ID, result: "passed", notes: "  Wiped " }),
    ).rejects.toThrow(`REDIRECT:/jobs/${JOB_ID}`);

    expect(rpcMock).toHaveBeenCalledWith("complete_cleaning", {
      p_job_id: JOB_ID,
      p_passed: true,
      p_notes: "Wiped",
    });
  });

  it("should send passed false for a failed cleaning", async () => {
    await expect(
      completeCleaningAction({ job_id: JOB_ID, result: "failed" }),
    ).rejects.toThrow("REDIRECT:");

    expect(rpcMock.mock.calls[0][1]).toMatchObject({ p_passed: false });
  });

  it("should return VALIDATION_ERROR and skip the call when the result is missing", async () => {
    const result = await completeCleaningAction({ job_id: JOB_ID });

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect when the caller lacks permission", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      completeCleaningAction({ job_id: JOB_ID, result: "passed" }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["JB010", "NOT_STARTED"],
    ["JB011", "ALREADY_RECORDED"],
    ["JB012", "SEAT_NOT_ELIGIBLE"],
    ["JB006", "JOB_NOT_ELIGIBLE"],
    ["P0002", "NOT_FOUND"],
    ["42501", "FORBIDDEN"],
    ["22023", "VALIDATION_ERROR"],
  ])("should map database error %s to %s", async (code, expected) => {
    rpcMock.mockResolvedValue({ error: { code, message: "raw" } });

    const result = await completeCleaningAction({
      job_id: JOB_ID,
      result: "passed",
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(expected);
  });
});
