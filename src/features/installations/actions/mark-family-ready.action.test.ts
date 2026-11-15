import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getContextMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/installations/lib/get-installation-context", () => ({
  getInstallationContext: getContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { markFamilyReadyAction } from "@/features/installations/actions/mark-family-ready.action";

const JOB_ID = "f0000000-0000-0000-0000-000000000002";
const BOOKING_ID = "b0000000-0000-0000-0000-000000000002";

const contextAt = (status: string, installation: unknown = { id: "i-1" }) => ({
  job: { id: JOB_ID },
  booking: { id: BOOKING_ID, status },
  installation,
});

describe("markFamilyReadyAction", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ role: "technician" });
    getContextMock.mockReset();
    getContextMock.mockResolvedValue(contextAt("installed"));
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ error: null });
  });

  it("should move the booking to Family Ready and show Today's jobs", async () => {
    await expect(markFamilyReadyAction({ job_id: JOB_ID })).rejects.toThrow(
      "REDIRECT:/technician",
    );

    expect(rpcMock).toHaveBeenCalledWith("move_booking_to_next_step", {
      p_booking_id: BOOKING_ID,
      p_expected_status: "installed",
    });
  });

  it("should catch the booking up from En Route in two steps", async () => {
    getContextMock.mockResolvedValue(contextAt("en_route"));

    await expect(markFamilyReadyAction({ job_id: JOB_ID })).rejects.toThrow("REDIRECT:");

    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  it("should refuse the second attempt when the booking is already Family Ready", async () => {
    getContextMock.mockResolvedValue(contextAt("family_ready"));

    const result = await markFamilyReadyAction({ job_id: JOB_ID });

    expect(result.error?.code).toBe("ALREADY_RECORDED");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should refuse when the installation is not recorded", async () => {
    getContextMock.mockResolvedValue(contextAt("en_route", null));

    const result = await markFamilyReadyAction({ job_id: JOB_ID });

    expect(result.error?.code).toBe("JOB_NOT_ELIGIBLE");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should return VALIDATION_ERROR for a job id that is not a uuid", async () => {
    const result = await markFamilyReadyAction({ job_id: "nope" });

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(getContextMock).not.toHaveBeenCalled();
  });

  it("should return NOT_FOUND for a job the user cannot see", async () => {
    getContextMock.mockResolvedValue(null);

    const result = await markFamilyReadyAction({ job_id: JOB_ID });

    expect(result.error?.code).toBe("NOT_FOUND");
  });

  it.each([
    ["42501", "FORBIDDEN"],
    ["BK007", "STALE_DATA"],
    ["BK009", "SEAT_NOT_ELIGIBLE"],
  ])("should map database error %s to %s", async (code, expected) => {
    rpcMock.mockResolvedValue({ error: { code, message: "raw" } });

    const result = await markFamilyReadyAction({ job_id: JOB_ID });

    expect(result.error?.code).toBe(expected);
  });
});
