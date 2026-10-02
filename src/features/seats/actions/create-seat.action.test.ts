import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const findDuplicateMock = vi.hoisted(() => vi.fn());
const checkCategoryMock = vi.hoisted(() => vi.fn());
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

vi.mock("@/features/seats/lib/find-duplicate-seat-serial", () => ({
  findDuplicateSeatSerial: findDuplicateMock,
}));

vi.mock("@/features/seats/lib/check-seat-category", () => ({
  checkSeatCategory: checkCategoryMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { createSeatAction } from "@/features/seats/actions/create-seat.action";

const OPS_USER = {
  id: "user-1",
  email: "ops@example.com",
  full_name: "Ops User",
  role: "operations_manager" as const,
  partner_id: null,
  is_active: true,
};

const SEAT_ID = "e0000000-0000-4000-8000-000000000099";

const VALID_INPUT = {
  serial_number: "SEAT-9001",
  manufacturer: "Britax",
  model: "Convertible C2",
  manufacture_date: "2025-01-15",
  purchase_date: "2025-02-01",
  max_rental_cycles: 300,
  category_id: "c0000000-0000-0000-0000-000000000001",
  airport_id: "a0000000-0000-0000-0000-000000000001",
};

describe("createSeatAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(OPS_USER);
    findDuplicateMock.mockReset();
    findDuplicateMock.mockResolvedValue({ duplicate: false });
    checkCategoryMock.mockReset();
    checkCategoryMock.mockResolvedValue({ allowed: true });
    singleMock.mockReset();
    selectMock.mockClear();
    insertMock.mockClear();
    fromMock.mockClear();
  });

  it("should insert the seat and redirect to its detail page on success", async () => {
    singleMock.mockResolvedValue({ data: { id: SEAT_ID }, error: null });

    await expect(createSeatAction(VALID_INPUT)).rejects.toThrow(
      `REDIRECT:/seats/${SEAT_ID}`,
    );

    expect(requirePermissionMock).toHaveBeenCalledWith("seats:manage");
    expect(fromMock).toHaveBeenCalledWith("seats");
    expect(insertMock).toHaveBeenCalledWith(VALID_INPUT);
  });

  it("should never send public_token, status or rental_cycles from client input", async () => {
    singleMock.mockResolvedValue({ data: { id: SEAT_ID }, error: null });

    await expect(
      createSeatAction({
        ...VALID_INPUT,
        public_token: "attacker-token",
        status: "retired",
        rental_cycles: 999,
      }),
    ).rejects.toThrow("REDIRECT:");

    expect(insertMock).toHaveBeenCalledWith(VALID_INPUT);
  });

  it("should return a validation error without touching Supabase when input is invalid", async () => {
    const result = await createSeatAction({
      ...VALID_INPUT,
      max_rental_cycles: 0,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should return a validation error when required fields are missing", async () => {
    const result = await createSeatAction({});

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should return DUPLICATE_SERIAL and not insert when the pre-check finds the serial", async () => {
    findDuplicateMock.mockResolvedValue({ duplicate: true });

    const result = await createSeatAction(VALID_INPUT);

    expect(result.error?.code).toBe("DUPLICATE_SERIAL");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should map a 23505 on serial_number from a concurrent insert to DUPLICATE_SERIAL", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "seats_serial_number_key"',
        details: "Key (serial_number)=(SEAT-9001) already exists.",
      },
    });

    const result = await createSeatAction(VALID_INPUT);

    expect(result.error?.code).toBe("DUPLICATE_SERIAL");
  });

  it("should map a 23505 on public_token to INTERNAL_ERROR, not DUPLICATE_SERIAL", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "seats_public_token_key"',
        details: "Key (public_token)=(abc) already exists.",
      },
    });

    const result = await createSeatAction(VALID_INPUT);

    expect(result.error?.code).toBe("INTERNAL_ERROR");
  });

  it("should reject an inactive or unknown category without inserting", async () => {
    checkCategoryMock.mockResolvedValue({ allowed: false });

    const result = await createSeatAction(VALID_INPUT);

    expect(result.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Select an active seat category.",
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should return FORBIDDEN when RLS denies the insert (42501)", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "new row violates row-level security policy" },
    });

    const result = await createSeatAction(VALID_INPUT);

    expect(result.error?.code).toBe("FORBIDDEN");
  });

  it("should propagate the permission guard's redirect and never call Supabase when unauthorized", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(createSeatAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(fromMock).not.toHaveBeenCalled();
    expect(findDuplicateMock).not.toHaveBeenCalled();
  });
});
