import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());

// update({ status: "inactive" }).eq("id", partner_id).neq("status", "inactive").select("id").maybeSingle()
const updateMaybeSingleMock = vi.hoisted(() => vi.fn());
const updateSelectMock = vi.hoisted(() =>
  vi.fn(() => ({ maybeSingle: updateMaybeSingleMock })),
);
const updateNeqMock = vi.hoisted(() =>
  vi.fn(() => ({ select: updateSelectMock })),
);
const updateEqMock = vi.hoisted(() => vi.fn(() => ({ neq: updateNeqMock })));
const updateMock = vi.hoisted(() => vi.fn(() => ({ eq: updateEqMock })));

// select("id").eq("id", partner_id).maybeSingle() — the follow-up
// existence check, only reached when the conditional update matches
// zero rows.
const existsMaybeSingleMock = vi.hoisted(() => vi.fn());
const existsEqMock = vi.hoisted(() =>
  vi.fn(() => ({ maybeSingle: existsMaybeSingleMock })),
);
const selectMock = vi.hoisted(() => vi.fn(() => ({ eq: existsEqMock })));

const fromMock = vi.hoisted(() =>
  vi.fn(() => ({ select: selectMock, update: updateMock })),
);

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

import { deactivatePartnerAction } from "@/features/partners/actions/deactivate-partner.action";

const ADMIN_USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

const PARTNER_ID = "b0000000-0000-0000-0000-000000000001";

describe("deactivatePartnerAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(ADMIN_USER);
    updateMaybeSingleMock.mockReset();
    existsMaybeSingleMock.mockReset();
    updateSelectMock.mockClear();
    updateNeqMock.mockClear();
    updateEqMock.mockClear();
    updateMock.mockClear();
    existsEqMock.mockClear();
    selectMock.mockClear();
    fromMock.mockClear();
  });

  it("should set status to 'inactive' via one conditional update and return success for an active partner", async () => {
    updateMaybeSingleMock.mockResolvedValue({
      data: { id: PARTNER_ID },
      error: null,
    });

    const result = await deactivatePartnerAction({ partner_id: PARTNER_ID });

    expect(result).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith({ status: "inactive" });
    expect(updateEqMock).toHaveBeenCalledWith("id", PARTNER_ID);
    expect(updateNeqMock).toHaveBeenCalledWith("status", "inactive");
    // The atomic update matched a row - no follow-up existence check needed.
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("should return CONFLICT (via the follow-up existence check) when the partner is already inactive", async () => {
    updateMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    existsMaybeSingleMock.mockResolvedValue({
      data: { id: PARTNER_ID },
      error: null,
    });

    const result = await deactivatePartnerAction({ partner_id: PARTNER_ID });

    expect(result).toEqual({
      success: false,
      error: {
        code: "CONFLICT",
        message: "This partner is already inactive.",
      },
    });
    expect(existsEqMock).toHaveBeenCalledWith("id", PARTNER_ID);
  });

  it("should return NOT_FOUND when the partner id does not match any row", async () => {
    updateMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    existsMaybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await deactivatePartnerAction({ partner_id: PARTNER_ID });

    expect(result).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Partner not found." },
    });
  });

  it("should return a validation error without calling Supabase for an empty partner_id", async () => {
    const result = await deactivatePartnerAction({ partner_id: "" });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should propagate the permission guard's rejection and never call Supabase when unauthorized", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      deactivatePartnerAction({ partner_id: PARTNER_ID }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(fromMock).not.toHaveBeenCalled();
  });
});
