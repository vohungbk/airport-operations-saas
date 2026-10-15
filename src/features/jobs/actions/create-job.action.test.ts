import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const singleMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn(() => ({ single: singleMock })));
const insertMock = vi.hoisted(() => vi.fn(() => ({ select: selectMock })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ insert: insertMock })));

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

import { createJobAction } from "@/features/jobs/actions/create-job.action";

const VALID_INPUT = {
  job_type: "installation",
  technician_id: "d0000000-0000-0000-0000-000000000001",
  booking_id: "f0000000-0000-0000-0000-000000000002",
};

describe("createJobAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ role: "operations_manager" });
    singleMock.mockReset();
    selectMock.mockClear();
    insertMock.mockClear();
    fromMock.mockClear();
  });

  it("should insert the job and redirect to /jobs/[id] on success", async () => {
    singleMock.mockResolvedValue({ data: { id: "job-1" }, error: null });

    await expect(createJobAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/jobs/job-1",
    );

    expect(requirePermissionMock).toHaveBeenCalledWith("technicians:manage");
    expect(fromMock).toHaveBeenCalledWith("technician_jobs");
    expect(insertMock).toHaveBeenCalledWith(VALID_INPUT);
  });

  it("should not insert client-supplied status or timestamps", async () => {
    singleMock.mockResolvedValue({ data: { id: "job-1" }, error: null });

    await expect(
      createJobAction({ ...VALID_INPUT, status: "completed", assigned_at: "x" }),
    ).rejects.toThrow("REDIRECT:");

    expect(insertMock).toHaveBeenCalledWith(VALID_INPUT);
  });

  it("should return VALIDATION_ERROR and skip the insert when the technician is missing", async () => {
    const result = await createJobAction({ ...VALID_INPUT, technician_id: "" });

    expect(result).toEqual({
      success: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect when the caller lacks permission", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(createJobAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should return TECHNICIAN_INACTIVE when the guard trigger rejects the technician", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "JB001", message: "Technician is not active" },
    });

    const result = await createJobAction(VALID_INPUT);

    expect(result.error?.code).toBe("TECHNICIAN_INACTIVE");
  });

  it("should return BOOKING_NOT_ACTIVE when the booking is closed", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "JB002", message: "Booking is not active" },
    });

    const result = await createJobAction(VALID_INPUT);

    expect(result.error?.code).toBe("BOOKING_NOT_ACTIVE");
  });

  it("should return DUPLICATE_JOB when an open job of this type exists", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });

    const result = await createJobAction(VALID_INPUT);

    expect(result.error?.code).toBe("DUPLICATE_JOB");
  });

  it("should not leak raw database errors", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "relation secret_table exploded" },
    });

    const result = await createJobAction(VALID_INPUT);

    expect(result.error?.code).toBe("INTERNAL_ERROR");
    expect(result.error?.message).not.toContain("secret_table");
  });
});
