import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getContextMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn(() => ({ insert: insertMock })));

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/cleaning/lib/get-cleaning-context", () => ({
  getCleaningContext: getContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { recordCleaningAction } from "@/features/cleaning/actions/record-cleaning.action";

const JOB_ID = "f0000000-0000-0000-0000-000000000002";
const SEAT_ID = "e0000000-0000-0000-0000-000000000002";

const CONTEXT = {
  job: { id: JOB_ID, status: "in_progress", job_type: "cleaning", technician_id: "t-1" },
  booking: {
    booking_number: "BK-00002",
    airport: { code: "DXB", name: "Dubai", timezone: "Asia/Dubai" },
    seat: { id: SEAT_ID, serial_number: "SN-2", category_name: "Infant" },
  },
  cleaning: null,
};

const VALID_INPUT = {
  job_id: JOB_ID,
  seat_id: SEAT_ID,
  cleaned_at: "2020-01-01T10:00",
  notes: "  Fitted  ",
};

describe("recordCleaningAction", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "technician" });
    getContextMock.mockReset();
    getContextMock.mockResolvedValue(CONTEXT);
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
    fromMock.mockClear();
  });

  it("should insert the cleaning and redirect to the job on success", async () => {
    await expect(recordCleaningAction(VALID_INPUT)).rejects.toThrow(
      `REDIRECT:/jobs/${JOB_ID}`,
    );

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "cleaning:create",
      "technicians:manage",
    ]);
    expect(fromMock).toHaveBeenCalledWith("cleaning_records");
    expect(insertMock).toHaveBeenCalledWith({
      technician_job_id: JOB_ID,
      seat_id: SEAT_ID,
      employee_id: "u-1",
      // 10:00 in Asia/Dubai (UTC+4); the form has one time, so both match.
      started_at: "2020-01-01T06:00:00.000Z",
      completed_at: "2020-01-01T06:00:00.000Z",
      notes: "Fitted",
    });
  });

  it("should take the employee from the session and ignore client-controlled columns", async () => {
    await expect(
      recordCleaningAction({
        ...VALID_INPUT,
        employee_id: "someone-else",
        booking_id: "another-booking",
        passed: true,
      }),
    ).rejects.toThrow("REDIRECT:");

    const payload = insertMock.mock.calls[0][0];
    expect(payload.employee_id).toBe("u-1");
    expect(payload).not.toHaveProperty("booking_id");
    expect(payload).not.toHaveProperty("passed");
  });

  it("should return VALIDATION_ERROR and skip the insert for an invalid time", async () => {
    const result = await recordCleaningAction({
      ...VALID_INPUT,
      cleaned_at: "not a time",
    });

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should return VALIDATION_ERROR when the submitted seat is not the booking's seat", async () => {
    const result = await recordCleaningAction({
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

    const result = await recordCleaningAction(VALID_INPUT);

    expect(result.error?.code).toBe("SEAT_NOT_ELIGIBLE");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should return NOT_FOUND when the job is outside the user's scope", async () => {
    getContextMock.mockResolvedValue(null);

    const result = await recordCleaningAction(VALID_INPUT);

    expect(result.error?.code).toBe("NOT_FOUND");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect when the caller lacks permission", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(recordCleaningAction(VALID_INPUT)).rejects.toThrow(
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

    const result = await recordCleaningAction(VALID_INPUT);

    expect(result.error?.code).toBe(expected);
  });
});
