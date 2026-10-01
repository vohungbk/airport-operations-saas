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

import { setSeatCategoryActiveAction } from "@/features/seat-categories/actions/set-seat-category-active.action";

const ADMIN_USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

const ID = "b0000000-0000-4000-8000-000000000001";

describe("setSeatCategoryActiveAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(ADMIN_USER);
    maybeSingleMock.mockReset();
    selectMock.mockClear();
    eqMock.mockClear();
    updateMock.mockClear();
    fromMock.mockClear();
  });

  it("should deactivate by setting is_active to false for one id", async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: ID }, error: null });

    const result = await setSeatCategoryActiveAction({
      seat_category_id: ID,
      is_active: false,
    });

    expect(result).toEqual({ success: true });
    expect(requirePermissionMock).toHaveBeenCalledWith("seat_categories:manage");
    expect(updateMock).toHaveBeenCalledWith({ is_active: false });
    expect(eqMock).toHaveBeenCalledWith("id", ID);
  });

  it("should activate by setting is_active to true", async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: ID }, error: null });

    const result = await setSeatCategoryActiveAction({
      seat_category_id: ID,
      is_active: true,
    });

    expect(result).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith({ is_active: true });
  });

  it("should return a validation error without touching Supabase for a bad input", async () => {
    const result = await setSeatCategoryActiveAction({
      seat_category_id: "nope",
      is_active: false,
    });

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return NOT_FOUND when no row matched", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await setSeatCategoryActiveAction({
      seat_category_id: ID,
      is_active: false,
    });

    expect(result.error?.code).toBe("NOT_FOUND");
  });

  it("should map a database error to a generic INTERNAL_ERROR", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "boom" },
    });

    const result = await setSeatCategoryActiveAction({
      seat_category_id: ID,
      is_active: false,
    });

    expect(result.error?.code).toBe("INTERNAL_ERROR");
  });

  it("should propagate the permission guard's redirect and never call Supabase when unauthorized", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      setSeatCategoryActiveAction({ seat_category_id: ID, is_active: false }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(fromMock).not.toHaveBeenCalled();
  });
});
