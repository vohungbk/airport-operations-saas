import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const checkCategoryMock = vi.hoisted(() => vi.fn());
const readMaybeSingleMock = vi.hoisted(() => vi.fn());
const writeMaybeSingleMock = vi.hoisted(() => vi.fn());
const readEqMock = vi.hoisted(() =>
  vi.fn(() => ({ maybeSingle: readMaybeSingleMock })),
);
const selectReadMock = vi.hoisted(() => vi.fn(() => ({ eq: readEqMock })));
const neqMock = vi.hoisted(() =>
  vi.fn(() => ({ select: () => ({ maybeSingle: writeMaybeSingleMock }) })),
);
const writeEqMock = vi.hoisted(() => vi.fn(() => ({ neq: neqMock })));
const updateMock = vi.hoisted(() => vi.fn(() => ({ eq: writeEqMock })));
const fromMock = vi.hoisted(() =>
  vi.fn(() => ({ select: selectReadMock, update: updateMock })),
);

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

vi.mock("@/features/seats/lib/check-seat-category", () => ({
  checkSeatCategory: checkCategoryMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { updateSeatAction } from "@/features/seats/actions/update-seat.action";

const OPS_USER = {
  id: "user-1",
  email: "ops@example.com",
  full_name: "Ops User",
  role: "operations_manager" as const,
  partner_id: null,
  is_active: true,
};

const ID = "e0000000-0000-4000-8000-000000000001";
const CATEGORY_ID = "c0000000-0000-0000-0000-000000000001";

const VALID_INPUT = {
  manufacturer: "Britax",
  model: "Convertible C2",
  manufacture_date: "2025-01-15",
  purchase_date: "2025-02-01",
  max_rental_cycles: 300,
  category_id: CATEGORY_ID,
  airport_id: "a0000000-0000-0000-0000-000000000001",
};

const EXISTING_SEAT = {
  id: ID,
  status: "available",
  rental_cycles: 10,
  category_id: CATEGORY_ID,
};

describe("updateSeatAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(OPS_USER);
    checkCategoryMock.mockReset();
    checkCategoryMock.mockResolvedValue({ allowed: true });
    readMaybeSingleMock.mockReset();
    readMaybeSingleMock.mockResolvedValue({ data: EXISTING_SEAT, error: null });
    writeMaybeSingleMock.mockReset();
    writeMaybeSingleMock.mockResolvedValue({ data: { id: ID }, error: null });
    for (const mock of [
      readEqMock,
      selectReadMock,
      neqMock,
      writeEqMock,
      updateMock,
      fromMock,
    ]) {
      mock.mockClear();
    }
  });

  it("should update the seat and redirect to its detail page on success", async () => {
    await expect(updateSeatAction(ID, VALID_INPUT)).rejects.toThrow(
      `REDIRECT:/seats/${ID}`,
    );

    expect(requirePermissionMock).toHaveBeenCalledWith("seats:manage");
    expect(updateMock).toHaveBeenCalledWith(VALID_INPUT);
    expect(writeEqMock).toHaveBeenCalledWith("id", ID);
  });

  it("should repeat the status <> retired guard in the update so a concurrent retire cannot slip through", async () => {
    await expect(updateSeatAction(ID, VALID_INPUT)).rejects.toThrow("REDIRECT:");

    expect(neqMock).toHaveBeenCalledWith("status", "retired");
  });

  it("should never write serial_number, public_token, status or rental_cycles from the input", async () => {
    await expect(
      updateSeatAction(ID, {
        ...VALID_INPUT,
        serial_number: "HACKED",
        public_token: "hacked",
        status: "available",
        rental_cycles: 0,
      }),
    ).rejects.toThrow("REDIRECT:");

    expect(updateMock).toHaveBeenCalledWith(VALID_INPUT);
  });

  it("should return a validation error and not update when input is invalid", async () => {
    const result = await updateSeatAction(ID, { ...VALID_INPUT, model: "" });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("should return a validation error when the id is not a uuid, without touching Supabase", async () => {
    const result = await updateSeatAction("not-a-uuid", VALID_INPUT);

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should reject max_rental_cycles below the seat's current rental_cycles with a specific message", async () => {
    const result = await updateSeatAction(ID, {
      ...VALID_INPUT,
      max_rental_cycles: 9,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(result.error?.message).toContain("current rental cycles (10)");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("should accept max_rental_cycles equal to the current rental_cycles", async () => {
    await expect(
      updateSeatAction(ID, { ...VALID_INPUT, max_rental_cycles: 10 }),
    ).rejects.toThrow(`REDIRECT:/seats/${ID}`);
  });

  it("should refuse to edit a retired seat with INVALID_TRANSITION", async () => {
    readMaybeSingleMock.mockResolvedValue({
      data: { ...EXISTING_SEAT, status: "retired" },
      error: null,
    });

    const result = await updateSeatAction(ID, VALID_INPUT);

    expect(result.error?.code).toBe("INVALID_TRANSITION");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("should return NOT_FOUND when the seat does not exist or RLS hides it", async () => {
    readMaybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await updateSeatAction(ID, VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Seat not found." },
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("should return NOT_FOUND when the update matches no row", async () => {
    writeMaybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await updateSeatAction(ID, VALID_INPUT);

    expect(result.error?.code).toBe("NOT_FOUND");
  });

  it("should reject switching to an inactive category", async () => {
    checkCategoryMock.mockResolvedValue({ allowed: false });

    const result = await updateSeatAction(ID, VALID_INPUT);

    expect(result.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Select an active seat category.",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("should pass the seat's current category so an already-inactive category does not block edits", async () => {
    await expect(updateSeatAction(ID, VALID_INPUT)).rejects.toThrow("REDIRECT:");

    expect(checkCategoryMock).toHaveBeenCalledWith(
      expect.anything(),
      CATEGORY_ID,
      CATEGORY_ID,
    );
  });

  it("should map a 23514 check violation to VALIDATION_ERROR", async () => {
    writeMaybeSingleMock.mockResolvedValue({
      data: null,
      error: { code: "23514", message: "check violation" },
    });

    const result = await updateSeatAction(ID, VALID_INPUT);

    expect(result.error?.code).toBe("VALIDATION_ERROR");
  });

  it("should map an RLS denial (42501) to FORBIDDEN", async () => {
    writeMaybeSingleMock.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "denied" },
    });

    const result = await updateSeatAction(ID, VALID_INPUT);

    expect(result.error?.code).toBe("FORBIDDEN");
  });

  it("should propagate the permission guard's redirect and never call Supabase when unauthorized", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(updateSeatAction(ID, VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(fromMock).not.toHaveBeenCalled();
  });
});
