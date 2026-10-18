import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

import { startCleaningAction } from "@/features/cleaning/actions/start-cleaning.action";

const JOB_ID = "f0000000-0000-0000-0000-000000000002";

describe("startCleaningAction", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "technician" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ error: null });
  });

  it("should call start_cleaning with the job and succeed", async () => {
    const result = await startCleaningAction({ job_id: JOB_ID });

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "cleaning:create",
      "technicians:manage",
    ]);
    expect(rpcMock).toHaveBeenCalledWith("start_cleaning", { p_job_id: JOB_ID });
    expect(result).toEqual({ success: true });
  });

  it("should return VALIDATION_ERROR and skip the call for a bad job id", async () => {
    const result = await startCleaningAction({ job_id: "nope" });

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should send nothing but the job id", async () => {
    await startCleaningAction({ job_id: JOB_ID, seat_id: "s-9", started_at: "x" });

    expect(rpcMock).toHaveBeenCalledWith("start_cleaning", { p_job_id: JOB_ID });
  });

  it("should propagate the guard's redirect when the caller lacks permission", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(startCleaningAction({ job_id: JOB_ID })).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["JB008", "SEAT_NOT_ELIGIBLE"],
    ["JB009", "SEAT_IN_USE"],
    ["23505", "ALREADY_RECORDED"],
    ["P0002", "NOT_FOUND"],
    ["42501", "FORBIDDEN"],
  ])("should map database error %s to %s", async (code, expected) => {
    rpcMock.mockResolvedValue({ error: { code, message: "raw" } });

    const result = await startCleaningAction({ job_id: JOB_ID });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(expected);
  });
});
