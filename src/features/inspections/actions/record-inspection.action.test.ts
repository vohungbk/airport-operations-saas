import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getContextMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn(() => ({ insert: insertMock })));

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/inspections/lib/get-inspection-context", () => ({
  getInspectionContext: getContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { recordInspectionAction } from "@/features/inspections/actions/record-inspection.action";

const JOB_ID = "f0000000-0000-0000-0000-000000000002";
const SEAT_ID = "e0000000-0000-0000-0000-000000000002";

const CONTEXT = {
  job: {
    id: JOB_ID,
    status: "in_progress",
    job_type: "inspection",
    technician_id: "t-1",
  },
  booking: {
    booking_number: "BK-00002",
    airport: { code: "DXB", name: "Dubai", timezone: "Asia/Dubai" },
    seat: {
      id: SEAT_ID,
      serial_number: "SN-2",
      status: "available",
      category_name: "Infant",
    },
  },
  inspection: null,
};

const VALID_INPUT = {
  job_id: JOB_ID,
  seat_id: SEAT_ID,
  result: "conditional_pass",
  notes: "  Strap worn  ",
};

describe("recordInspectionAction", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "technician" });
    getContextMock.mockReset();
    getContextMock.mockResolvedValue(CONTEXT);
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
    fromMock.mockClear();
  });

  it("should insert the inspection and redirect to the job on success", async () => {
    await expect(recordInspectionAction(VALID_INPUT)).rejects.toThrow(
      `REDIRECT:/jobs/${JOB_ID}`,
    );

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "inspections:create",
      "technicians:manage",
    ]);
    expect(fromMock).toHaveBeenCalledWith("inspection_records");
    expect(insertMock).toHaveBeenCalledWith({
      technician_job_id: JOB_ID,
      seat_id: SEAT_ID,
      inspector_id: "u-1",
      inspection_type: "general",
      result: "conditional_pass",
      notes: "Strap worn",
    });
  });

  it("should redirect to the inspection page when the result is fail so the follow-up is shown", async () => {
    await expect(
      recordInspectionAction({ ...VALID_INPUT, result: "fail" }),
    ).rejects.toThrow(`REDIRECT:/jobs/${JOB_ID}/inspection`);
  });

  it.each([["pass"], ["conditional_pass"]])(
    "should redirect to the job when the result is %s",
    async (result) => {
      await expect(
        recordInspectionAction({ ...VALID_INPUT, result }),
      ).rejects.toThrow(`REDIRECT:/jobs/${JOB_ID}`);
    },
  );

  it("should take the inspector from the session and ignore client-controlled columns", async () => {
    await expect(
      recordInspectionAction({
        ...VALID_INPUT,
        inspector_id: "someone-else",
        booking_id: "another-booking",
        inspection_type: "pre_rental",
      }),
    ).rejects.toThrow("REDIRECT:");

    const payload = insertMock.mock.calls[0][0];
    expect(payload.inspector_id).toBe("u-1");
    expect(payload.inspection_type).toBe("general");
    expect(payload).not.toHaveProperty("booking_id");
  });

  it.each([["admin"], ["operations_manager"]])(
    "should record as the %s user, not as the technician of the job",
    async (role) => {
      requireAnyPermissionMock.mockResolvedValue({ id: "internal-1", role });

      await expect(recordInspectionAction(VALID_INPUT)).rejects.toThrow(
        "REDIRECT:",
      );

      expect(insertMock.mock.calls[0][0].inspector_id).toBe("internal-1");
    },
  );

  it.each([[undefined], ["maybe"], [""], [null]])(
    "should return VALIDATION_ERROR and skip the insert for the result %j",
    async (result) => {
      const response = await recordInspectionAction({
        ...VALID_INPUT,
        result,
      });

      expect(response.error?.code).toBe("VALIDATION_ERROR");
      expect(insertMock).not.toHaveBeenCalled();
    },
  );

  it("should return VALIDATION_ERROR when the submitted seat is not the booking's seat", async () => {
    const response = await recordInspectionAction({
      ...VALID_INPUT,
      seat_id: "e0000000-0000-0000-0000-000000000009",
    });

    expect(response.error?.code).toBe("VALIDATION_ERROR");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should return an error when the booking has no seat", async () => {
    getContextMock.mockResolvedValue({
      ...CONTEXT,
      booking: { ...CONTEXT.booking, seat: null },
    });

    const response = await recordInspectionAction(VALID_INPUT);

    expect(response.error?.code).toBe("SEAT_NOT_ELIGIBLE");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should return NOT_FOUND when the job is outside the user's scope", async () => {
    getContextMock.mockResolvedValue(null);

    const response = await recordInspectionAction(VALID_INPUT);

    expect(response.error?.code).toBe("NOT_FOUND");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should return NOT_FOUND and skip the insert when a technician submits a job assigned to someone else (FO-F04-S03)", async () => {
    requireAnyPermissionMock.mockResolvedValue({ id: "t-2", role: "technician" });
    // RLS hides t-1's job from t-2, so the context lookup finds nothing.
    getContextMock.mockResolvedValue(null);

    const response = await recordInspectionAction(VALID_INPUT);

    expect(getContextMock).toHaveBeenCalledWith(JOB_ID);
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe("NOT_FOUND");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect when the caller lacks permission", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(recordInspectionAction(VALID_INPUT)).rejects.toThrow(
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

    const response = await recordInspectionAction(VALID_INPUT);

    expect(response.error?.code).toBe(expected);
  });
});
