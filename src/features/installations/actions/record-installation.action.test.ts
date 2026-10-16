import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getContextMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn(() => ({ insert: insertMock })));

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/installations/lib/get-installation-context", () => ({
  getInstallationContext: getContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { recordInstallationAction } from "@/features/installations/actions/record-installation.action";

const JOB_ID = "f0000000-0000-0000-0000-000000000002";
const SEAT_ID = "e0000000-0000-0000-0000-000000000002";

const CONTEXT = {
  job: { id: JOB_ID, status: "in_progress", job_type: "installation", technician_id: "t-1" },
  booking: {
    booking_number: "BK-00002",
    airport: { code: "DXB", name: "Dubai", timezone: "Asia/Dubai" },
    seat: { id: SEAT_ID, serial_number: "SN-2", category_name: "Infant" },
  },
  installation: null,
};

const VALID_INPUT = {
  job_id: JOB_ID,
  seat_id: SEAT_ID,
  installed_at: "2020-01-01T10:00",
  notes: "  Fitted  ",
};

describe("recordInstallationAction", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ role: "technician" });
    getContextMock.mockReset();
    getContextMock.mockResolvedValue(CONTEXT);
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
    fromMock.mockClear();
  });

  it("should insert the installation and redirect to the job on success", async () => {
    await expect(recordInstallationAction(VALID_INPUT)).rejects.toThrow(
      `REDIRECT:/jobs/${JOB_ID}`,
    );

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "installation:perform",
      "technicians:manage",
    ]);
    expect(fromMock).toHaveBeenCalledWith("installations");
    expect(insertMock).toHaveBeenCalledWith({
      technician_job_id: JOB_ID,
      // 10:00 in Asia/Dubai (UTC+4)
      completed_at: "2020-01-01T06:00:00.000Z",
      notes: "Fitted",
      installation_completed: true,
    });
  });

  it("should not send seat_id, created_by or other client-controlled columns", async () => {
    await expect(
      recordInstallationAction({
        ...VALID_INPUT,
        created_by: "someone-else",
        seat_verified: true,
      }),
    ).rejects.toThrow("REDIRECT:");

    const payload = insertMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty("seat_id");
    expect(payload).not.toHaveProperty("created_by");
    expect(payload).not.toHaveProperty("seat_verified");
  });

  it("should return VALIDATION_ERROR and skip the insert for an invalid time", async () => {
    const result = await recordInstallationAction({
      ...VALID_INPUT,
      installed_at: "not a time",
    });

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should return VALIDATION_ERROR when the submitted seat is not the booking's seat", async () => {
    const result = await recordInstallationAction({
      ...VALID_INPUT,
      seat_id: "e0000000-0000-0000-0000-000000000009",
    });

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should return an error when the booking has no seat", async () => {
    getContextMock.mockResolvedValue({
      ...CONTEXT,
      booking: { ...CONTEXT.booking, seat: null },
    });

    const result = await recordInstallationAction(VALID_INPUT);

    expect(result.error?.code).toBe("SEAT_NOT_ELIGIBLE");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should return NOT_FOUND when the job is outside the user's scope", async () => {
    getContextMock.mockResolvedValue(null);

    const result = await recordInstallationAction(VALID_INPUT);

    expect(result.error?.code).toBe("NOT_FOUND");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect when the caller lacks permission", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(recordInstallationAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(getContextMock).not.toHaveBeenCalled();
  });

  it.each([
    ["23505", "ALREADY_RECORDED"],
    ["JB005", "JOB_NOT_ELIGIBLE"],
    ["JB006", "JOB_NOT_ELIGIBLE"],
    ["JB007", "SEAT_NOT_ELIGIBLE"],
    ["42501", "FORBIDDEN"],
  ])("should map database error %s to %s", async (code, expected) => {
    insertMock.mockResolvedValue({ error: { code, message: "raw" } });

    const result = await recordInstallationAction(VALID_INPUT);

    expect(result.error?.code).toBe(expected);
  });
});
