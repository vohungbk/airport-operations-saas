import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const singleMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn(() => ({ single: singleMock })));
const insertMock = vi.hoisted(() => vi.fn(() => ({ select: selectMock })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ insert: insertMock })));

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { reportIncidentAction } from "@/features/incidents/actions/report-incident.action";

const JOB_ID = "f0000000-0000-0000-0000-000000000002";
const INCIDENT_ID = "c0000000-0000-0000-0000-000000000001";

const VALID_INPUT = {
  job_id: JOB_ID,
  severity: "high",
  description: "  The harness strap is torn.  ",
};

describe("reportIncidentAction", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "admin" });
    singleMock.mockReset();
    singleMock.mockResolvedValue({ data: { id: INCIDENT_ID }, error: null });
    insertMock.mockClear();
    fromMock.mockClear();
  });

  it("should guard the action with the report permissions", async () => {
    await expect(reportIncidentAction(VALID_INPUT)).rejects.toThrow("REDIRECT:");

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "incidents:report",
      "incidents:view",
    ]);
  });

  it("should insert the job, severity and trimmed description and open the incident for a manager", async () => {
    await expect(reportIncidentAction(VALID_INPUT)).rejects.toThrow(
      `REDIRECT:/incidents/${INCIDENT_ID}`,
    );

    expect(fromMock).toHaveBeenCalledWith("incidents");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        technician_job_id: JOB_ID,
        severity: "high",
        description: "The harness strap is torn.",
        reported_by: "u-1",
      }),
    );
  });

  it("should send a technician back to the job, because they cannot open the incident yet", async () => {
    requireAnyPermissionMock.mockResolvedValue({ id: "t-1", role: "technician" });

    await expect(reportIncidentAction(VALID_INPUT)).rejects.toThrow(
      `REDIRECT:/jobs/${JOB_ID}`,
    );
  });

  it("should not take the partner, booking, seat or status from the client", async () => {
    await expect(
      reportIncidentAction({
        ...VALID_INPUT,
        partner_id: "forged-partner",
        booking_id: "forged-booking",
        seat_id: "forged-seat",
        status: "resolved",
        reported_by: "forged-user",
      }),
    ).rejects.toThrow("REDIRECT:");

    const row = (insertMock.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(row.reported_by).toBe("u-1");
    expect(row).not.toHaveProperty("booking_id");
    expect(row).not.toHaveProperty("seat_id");
    expect(row).not.toHaveProperty("status");
    expect(row.partner_id).not.toBe("forged-partner");
  });

  it.each([
    [{ ...VALID_INPUT, severity: undefined }],
    [{ ...VALID_INPUT, severity: "urgent" }],
    [{ ...VALID_INPUT, description: "   " }],
    [{ ...VALID_INPUT, job_id: "nope" }],
    [null],
  ])(
    "should return VALIDATION_ERROR and skip the insert for %j",
    async (input) => {
      const response = await reportIncidentAction(input);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("VALIDATION_ERROR");
      expect(insertMock).not.toHaveBeenCalled();
    },
  );

  it("should propagate the guard's redirect when the caller lacks permission", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(reportIncidentAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it.each([
    ["P0002", "NOT_FOUND"],
    ["42501", "FORBIDDEN"],
    ["23503", "VALIDATION_ERROR"],
    ["XX000", "INTERNAL_ERROR"],
  ])("should map database error %s to %s without exposing the raw message", async (code, expected) => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code, message: "raw database text" },
    });

    const response = await reportIncidentAction(VALID_INPUT);

    expect(response.error?.code).toBe(expected);
    expect(response.error?.message).not.toContain("raw database text");
  });
});
