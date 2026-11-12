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

import { RETURN_CHAIN_STEP_PERMISSIONS } from "@/lib/auth/permissions";
import { completeChainStepAction } from "@/features/return-queue/actions/complete-chain-step.action";

const BOOKING_ID = "b0000000-0000-0000-0000-000000000123";

const INPUT = {
  booking_id: BOOKING_ID,
  step: "cleaning",
  result: "fail",
  checklist: { shell_cleaned: true, harness_cleaned: true, straps_cleaned: true },
  notes: "Torn strap",
  photo_paths: [`${BOOKING_ID}/cleaning/p-1.jpg`],
};

describe("completeChainStepAction", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "operations_manager" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ error: null });
  });

  it("should store the step and go back to the Return queue", async () => {
    await expect(completeChainStepAction(INPUT)).rejects.toThrow("REDIRECT:/return-queue");

    expect(requireAnyPermissionMock).toHaveBeenCalledWith(RETURN_CHAIN_STEP_PERMISSIONS);
    expect(rpcMock).toHaveBeenCalledWith("complete_return_chain_step", {
      p_booking_id: BOOKING_ID,
      p_step: "cleaning",
      p_result: "fail",
      p_checklist: INPUT.checklist,
      p_notes: "Torn strap",
      p_photo_paths: INPUT.photo_paths,
    });
  });

  it("should send the technician back to their home after the step is stored (FO-F08-S08)", async () => {
    requireAnyPermissionMock.mockResolvedValue({ id: "t-1", role: "technician" });

    await expect(completeChainStepAction(INPUT)).rejects.toThrow("REDIRECT:/technician");
  });

  it("should return a validation error and store nothing when the input is invalid", async () => {
    const result = await completeChainStepAction({ ...INPUT, notes: "" });

    expect(result).toEqual({
      success: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["no photo", []],
    ["a photo of another step", [`${BOOKING_ID}/drying/p-1.jpg`]],
  ])("should refuse the step and store nothing with %s", async (_name, photo_paths) => {
    const result = await completeChainStepAction({ ...INPUT, photo_paths });

    expect(result).toEqual({
      success: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "RC001", details: "drying" }, "OUT_OF_ORDER", "This step is not the next one. The seat is at Drying."],
    [
      { code: "22023", details: "", message: "A photo is required for this step" },
      "PHOTO_REQUIRED",
      "Add a photo of this step.",
    ],
    [{ code: "42501", details: "" }, "FORBIDDEN", "You do not have permission to complete this step."],
    [{ code: "55000", details: "" }, "SEAT_IN_QUARANTINE", "This seat is in quarantine. Its chain is stopped."],
    [
      { code: "RC002", details: "" },
      "BOOKING_CONFLICT",
      "Another booking holds or uses the seat now or soon. Handle that booking first, then complete this step.",
    ],
  ])("should map database error %o to a clear message", async (error, code, message) => {
    rpcMock.mockResolvedValue({ error });

    expect(await completeChainStepAction(INPUT)).toEqual({
      success: false,
      error: { code, message },
    });
  });
});
