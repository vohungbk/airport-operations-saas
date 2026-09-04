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

import { createPartnerAction } from "@/features/partners/actions/create-partner.action";

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
  code: "ERAC",
  contact_email: "ops@erac.example.com",
  status: "active",
};

describe("createPartnerAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(ADMIN_USER);
    singleMock.mockReset();
    selectMock.mockClear();
    insertMock.mockClear();
    fromMock.mockClear();
  });

  it("should insert the partner and redirect to /partners/[id] on success", async () => {
    singleMock.mockResolvedValue({ data: { id: "partner-1" }, error: null });

    await expect(createPartnerAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/partners/partner-1",
    );

    expect(requirePermissionMock).toHaveBeenCalledWith("partners:manage");
    expect(fromMock).toHaveBeenCalledWith("partners");
    expect(insertMock).toHaveBeenCalledWith(VALID_INPUT);
  });

  it("should return a validation error without calling Supabase when name is missing", async () => {
    const withoutName: Record<string, unknown> = { ...VALID_INPUT };
    delete withoutName.name;

    const result = await createPartnerAction(withoutName);

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error without calling Supabase when contact_email is invalid", async () => {
    const result = await createPartnerAction({
      ...VALID_INPUT,
      contact_email: "not-an-email",
    });

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error without calling Supabase when status is invalid", async () => {
    const result = await createPartnerAction({
      ...VALID_INPUT,
      status: "not-a-status",
    });

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should map a 23505 unique violation to DUPLICATE_CODE", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });

    const result = await createPartnerAction(VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: {
        code: "DUPLICATE_CODE",
        message: "A partner with this code already exists.",
      },
    });
  });

  it("should map any other Postgres error to a generic INTERNAL_ERROR", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "23502", message: "not null violation" },
    });

    const result = await createPartnerAction(VALID_INPUT);

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

    await expect(createPartnerAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(fromMock).not.toHaveBeenCalled();
  });
});
