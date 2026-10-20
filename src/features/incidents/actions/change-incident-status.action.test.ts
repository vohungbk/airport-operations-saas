import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

import { changeIncidentStatusAction } from "@/features/incidents/actions/change-incident-status.action";

const INCIDENT_ID = "c0000000-0000-0000-0000-000000000001";
const VALID_INPUT = {
  incident_id: INCIDENT_ID,
  from_status: "open",
  to_status: "investigating",
  note: "  Looking into it  ",
};

describe("changeIncidentStatusAction", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "admin" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ error: null });
  });

  it("should guard the action with the status update permissions", async () => {
    await changeIncidentStatusAction(VALID_INPUT);

    expect(requireAnyPermissionMock).toHaveBeenCalledWith(["incidents:view"]);
  });

  it("should call change_incident_status with the trimmed note and return success", async () => {
    const response = await changeIncidentStatusAction(VALID_INPUT);

    expect(response).toEqual({ success: true });
    expect(rpcMock).toHaveBeenCalledWith("change_incident_status", {
      p_incident_id: INCIDENT_ID,
      p_from_status: "open",
      p_to_status: "investigating",
      p_note: "Looking into it",
    });
  });

  it("should send no note when there is none", async () => {
    await changeIncidentStatusAction({ ...VALID_INPUT, note: "   " });

    expect(rpcMock.mock.calls[0][1].p_note).toBeUndefined();
  });

  it.each([
    [{ ...VALID_INPUT, to_status: "done" }],
    [{ ...VALID_INPUT, to_status: undefined }],
    [{ ...VALID_INPUT, incident_id: "nope" }],
    [{ ...VALID_INPUT, from_status: "resolved", to_status: "investigating", note: "" }],
    [null],
  ])("should return VALIDATION_ERROR and skip the call for %j", async (input) => {
    const response = await changeIncidentStatusAction(input);

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe("VALIDATION_ERROR");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect when the caller lacks permission", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(changeIncidentStatusAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["42501", "FORBIDDEN"],
    ["P0002", "NOT_FOUND"],
    ["55000", "INVALID_TRANSITION"],
    ["JB004", "STALE_DATA"],
    ["22023", "VALIDATION_ERROR"],
    ["XX000", "INTERNAL_ERROR"],
  ])("should map database error %s to %s without the raw message", async (code, expected) => {
    rpcMock.mockResolvedValue({ error: { code, message: "raw database text" } });

    const response = await changeIncidentStatusAction(VALID_INPUT);

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe(expected);
    expect(response.error?.message).not.toContain("raw database text");
  });
});
