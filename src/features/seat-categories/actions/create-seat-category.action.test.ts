import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const findDuplicateMock = vi.hoisted(() => vi.fn());
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

vi.mock("@/features/seat-categories/lib/find-duplicate-seat-category", () => ({
  findDuplicateSeatCategoryName: findDuplicateMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { createSeatCategoryAction } from "@/features/seat-categories/actions/create-seat-category.action";

const ADMIN_USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

const VALID_INPUT = {
  name: "Infant Carrier",
  description: "Rear-facing seat",
  min_child_age: 0,
  max_child_age: 12,
  safety_standard: "ECE R129",
  is_active: true,
};

describe("createSeatCategoryAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(ADMIN_USER);
    findDuplicateMock.mockReset();
    findDuplicateMock.mockResolvedValue({ duplicate: false });
    singleMock.mockReset();
    selectMock.mockClear();
    insertMock.mockClear();
    fromMock.mockClear();
  });

  it("should insert the seat category and redirect to its detail page on success", async () => {
    singleMock.mockResolvedValue({ data: { id: "sc-1" }, error: null });

    await expect(createSeatCategoryAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/seat-categories/sc-1",
    );

    expect(requirePermissionMock).toHaveBeenCalledWith("seat_categories:manage");
    expect(fromMock).toHaveBeenCalledWith("seat_categories");
    expect(insertMock).toHaveBeenCalledWith(VALID_INPUT);
    expect(findDuplicateMock).toHaveBeenCalledWith(
      expect.anything(),
      "Infant Carrier",
    );
  });

  it("should store a blank description as null", async () => {
    singleMock.mockResolvedValue({ data: { id: "sc-1" }, error: null });

    await expect(
      createSeatCategoryAction({ ...VALID_INPUT, description: "" }),
    ).rejects.toThrow("REDIRECT:");

    expect(insertMock).toHaveBeenCalledWith({
      ...VALID_INPUT,
      description: null,
    });
  });

  it("should return a validation error without touching Supabase when a field is missing", async () => {
    const withoutName: Record<string, unknown> = { ...VALID_INPUT };
    delete withoutName.name;

    const result = await createSeatCategoryAction(withoutName);

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(findDuplicateMock).not.toHaveBeenCalled();
  });

  it("should return a validation error when max age is below min age", async () => {
    const result = await createSeatCategoryAction({
      ...VALID_INPUT,
      min_child_age: 24,
      max_child_age: 12,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should return DUPLICATE_NAME and not insert when the name already exists", async () => {
    findDuplicateMock.mockResolvedValue({ duplicate: true });

    const result = await createSeatCategoryAction(VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: {
        code: "DUPLICATE_NAME",
        message: "A seat category with this name already exists.",
      },
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should map a failing duplicate check to a generic error", async () => {
    findDuplicateMock.mockResolvedValue({
      error: { code: "XX000", message: "boom" },
    });

    const result = await createSeatCategoryAction(VALID_INPUT);

    expect(result.error?.code).toBe("INTERNAL_ERROR");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should map an insert error to a generic INTERNAL_ERROR", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "23502", message: "not null violation" },
    });

    const result = await createSeatCategoryAction(VALID_INPUT);

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

    await expect(createSeatCategoryAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(fromMock).not.toHaveBeenCalled();
    expect(findDuplicateMock).not.toHaveBeenCalled();
  });
});
