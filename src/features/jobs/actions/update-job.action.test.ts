import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() =>
  vi.fn(() => ({ maybeSingle: maybeSingleMock })),
);
const eqMock = vi.hoisted(() => vi.fn(() => ({ select: selectMock })));
const updateMock = vi.hoisted(() => vi.fn(() => ({ eq: eqMock })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ update: updateMock })));

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { updateJobAction } from "@/features/jobs/actions/update-job.action";

const JOB_ID = "a0000000-0000-0000-0000-000000000009";
const VALID_INPUT = {
  id: JOB_ID,
  job_type: "cleaning",
  technician_id: "d0000000-0000-0000-0000-000000000001",
};

describe("updateJobAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ role: "operations_manager" });
    maybeSingleMock.mockReset();
    selectMock.mockClear();
    eqMock.mockClear();
    updateMock.mockClear();
    fromMock.mockClear();
  });

  it("should update only the job type and technician, then redirect to the job", async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: JOB_ID }, error: null });

    await expect(
      updateJobAction({
        ...VALID_INPUT,
        booking_id: "f0000000-0000-0000-0000-000000000002",
        status: "completed",
      }),
    ).rejects.toThrow(`REDIRECT:/jobs/${JOB_ID}?saved=job`);

    expect(requirePermissionMock).toHaveBeenCalledWith("technicians:manage");
    expect(fromMock).toHaveBeenCalledWith("technician_jobs");
    expect(updateMock).toHaveBeenCalledWith({
      job_type: "cleaning",
      technician_id: VALID_INPUT.technician_id,
    });
    expect(eqMock).toHaveBeenCalledWith("id", JOB_ID);
  });

  it("should return a validation error and not touch the database when the input is invalid", async () => {
    const result = await updateJobAction({ ...VALID_INPUT, job_type: "" });

    expect(result).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect when the user may not manage jobs", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(updateJobAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return not found when no row was updated", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await updateJobAction(VALID_INPUT);

    expect(result).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("should map an inactive technician from the database to its error", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { code: "JB001", message: "raw database text" },
    });

    const result = await updateJobAction(VALID_INPUT);

    expect(result).toMatchObject({
      success: false,
      error: { code: "TECHNICIAN_INACTIVE" },
    });
    expect(JSON.stringify(result)).not.toContain("raw database text");
  });
});
