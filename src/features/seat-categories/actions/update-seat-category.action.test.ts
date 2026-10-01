import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const findDuplicateMock = vi.hoisted(() => vi.fn());
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

vi.mock("@/features/seat-categories/lib/find-duplicate-seat-category", () => ({
  findDuplicateSeatCategoryName: findDuplicateMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { updateSeatCategoryAction } from "@/features/seat-categories/actions/update-seat-category.action";

const ADMIN_USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

const ID = "b0000000-0000-4000-8000-000000000001";

const VALID_INPUT = {
  name: "Infant Carrier",
  description: null,
  min_child_age: 0,
  max_child_age: 12,
  safety_standard: "ECE R129",
};

describe("updateSeatCategoryAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(ADMIN_USER);
    findDuplicateMock.mockReset();
    findDuplicateMock.mockResolvedValue({ duplicate: false });
    maybeSingleMock.mockReset();
    selectMock.mockClear();
    eqMock.mockClear();
    updateMock.mockClear();
    fromMock.mockClear();
  });

  it("should update the seat category and redirect to its detail page on success", async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: ID }, error: null });

    await expect(updateSeatCategoryAction(ID, VALID_INPUT)).rejects.toThrow(
      `REDIRECT:/seat-categories/${ID}`,
    );

    expect(requirePermissionMock).toHaveBeenCalledWith("seat_categories:manage");
    expect(fromMock).toHaveBeenCalledWith("seat_categories");
    expect(updateMock).toHaveBeenCalledWith(VALID_INPUT);
    expect(eqMock).toHaveBeenCalledWith("id", ID);
  });

  it("should exclude its own id from the duplicate-name check", async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: ID }, error: null });

    await expect(updateSeatCategoryAction(ID, VALID_INPUT)).rejects.toThrow(
      "REDIRECT:",
    );

    expect(findDuplicateMock).toHaveBeenCalledWith(
      expect.anything(),
      "Infant Carrier",
      ID,
    );
  });

  it("should never write id or is_active from the input", async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: ID }, error: null });

    await expect(
      updateSeatCategoryAction(ID, {
        ...VALID_INPUT,
        id: "attacker-id",
        is_active: false,
      }),
    ).rejects.toThrow("REDIRECT:");

    expect(updateMock).toHaveBeenCalledWith(VALID_INPUT);
  });

  it("should return a validation error without touching Supabase when input is invalid", async () => {
    const result = await updateSeatCategoryAction(ID, {
      ...VALID_INPUT,
      min_child_age: -1,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error when the id is not a uuid", async () => {
    const result = await updateSeatCategoryAction("not-a-uuid", VALID_INPUT);

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return DUPLICATE_NAME and not update when another category has the name", async () => {
    findDuplicateMock.mockResolvedValue({ duplicate: true });

    const result = await updateSeatCategoryAction(ID, VALID_INPUT);

    expect(result.error?.code).toBe("DUPLICATE_NAME");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("should return NOT_FOUND when no row was updated", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await updateSeatCategoryAction(ID, VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Seat category not found." },
    });
  });

  it("should map a 23514 check violation to VALIDATION_ERROR", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { code: "23514", message: "check violation" },
    });

    const result = await updateSeatCategoryAction(ID, VALID_INPUT);

    expect(result.error?.code).toBe("VALIDATION_ERROR");
  });

  it("should propagate the permission guard's redirect and never call Supabase when unauthorized", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(updateSeatCategoryAction(ID, VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(fromMock).not.toHaveBeenCalled();
  });
});
