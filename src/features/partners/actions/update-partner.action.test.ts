import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn(() => ({ maybeSingle: maybeSingleMock })));
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

import { updatePartnerAction } from "@/features/partners/actions/update-partner.action";

const ADMIN_USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

const VALID_INPUT = {
  name: "Emirates Rent A Car",
  contact_email: "ops@erac.example.com",
  status: "active",
};

describe("updatePartnerAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(ADMIN_USER);
    maybeSingleMock.mockReset();
    selectMock.mockClear();
    eqMock.mockClear();
    updateMock.mockClear();
    fromMock.mockClear();
  });

  it("should update the partner and redirect to /partners/[id] on success", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "partner-1" },
      error: null,
    });

    await expect(
      updatePartnerAction("partner-1", VALID_INPUT),
    ).rejects.toThrow("REDIRECT:/partners/partner-1");

    expect(requirePermissionMock).toHaveBeenCalledWith("partners:manage");
    expect(fromMock).toHaveBeenCalledWith("partners");
    expect(updateMock).toHaveBeenCalledWith(VALID_INPUT);
    expect(eqMock).toHaveBeenCalledWith("id", "partner-1");
  });

  it("should never accept a code field, even if one is injected into the input", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "partner-1" },
      error: null,
    });

    await expect(
      updatePartnerAction("partner-1", {
        ...VALID_INPUT,
        code: "ATTACKER-CHANGED-CODE",
      }),
    ).rejects.toThrow("REDIRECT:/partners/partner-1");

    expect(updateMock).toHaveBeenCalledWith(VALID_INPUT);
  });

  it("should return a validation error without calling Supabase when contact_email is invalid", async () => {
    const result = await updatePartnerAction("partner-1", {
      ...VALID_INPUT,
      contact_email: "not-an-email",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return NOT_FOUND when the partner id does not match any row", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await updatePartnerAction("missing-id", VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Partner not found." },
    });
  });

  it("should map a Postgres error to a generic INTERNAL_ERROR", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { code: "23502", message: "not null violation" },
    });

    const result = await updatePartnerAction("partner-1", VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    });
  });

  it("should propagate the permission guard's redirect and never call Supabase when unauthorized", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      updatePartnerAction("partner-1", VALID_INPUT),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(fromMock).not.toHaveBeenCalled();
  });
});
