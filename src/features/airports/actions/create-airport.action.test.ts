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

import { createAirportAction } from "@/features/airports/actions/create-airport.action";

const ADMIN_USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

const VALID_INPUT = {
  code: "DXB",
  name: "Dubai International Airport",
  city: "Dubai",
  country: "United Arab Emirates",
  timezone: "Asia/Dubai",
};

describe("createAirportAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(ADMIN_USER);
    singleMock.mockReset();
    selectMock.mockClear();
    insertMock.mockClear();
    fromMock.mockClear();
  });

  it("should insert the airport and redirect to /airports/[id] on success", async () => {
    singleMock.mockResolvedValue({ data: { id: "airport-1" }, error: null });

    await expect(createAirportAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/airports/airport-1",
    );

    expect(requirePermissionMock).toHaveBeenCalledWith("airports:manage");
    expect(fromMock).toHaveBeenCalledWith("airports");
    expect(insertMock).toHaveBeenCalledWith(VALID_INPUT);
  });

  it("should uppercase a lowercase code before inserting", async () => {
    singleMock.mockResolvedValue({ data: { id: "airport-1" }, error: null });

    await expect(
      createAirportAction({ ...VALID_INPUT, code: "dxb" }),
    ).rejects.toThrow("REDIRECT:/airports/airport-1");

    expect(insertMock).toHaveBeenCalledWith({ ...VALID_INPUT, code: "DXB" });
  });

  it("should return a validation error without calling Supabase when name is missing", async () => {
    const withoutName: Record<string, unknown> = { ...VALID_INPUT };
    delete withoutName.name;

    const result = await createAirportAction(withoutName);

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error without calling Supabase when code is missing", async () => {
    const withoutCode: Record<string, unknown> = { ...VALID_INPUT };
    delete withoutCode.code;

    const result = await createAirportAction(withoutCode);

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error without calling Supabase when city is missing", async () => {
    const withoutCity: Record<string, unknown> = { ...VALID_INPUT };
    delete withoutCity.city;

    const result = await createAirportAction(withoutCity);

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error without calling Supabase when country is missing", async () => {
    const withoutCountry: Record<string, unknown> = { ...VALID_INPUT };
    delete withoutCountry.country;

    const result = await createAirportAction(withoutCountry);

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error without calling Supabase when timezone is missing", async () => {
    const withoutTimezone: Record<string, unknown> = { ...VALID_INPUT };
    delete withoutTimezone.timezone;

    const result = await createAirportAction(withoutTimezone);

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error without calling Supabase when the code format is invalid", async () => {
    const result = await createAirportAction({
      ...VALID_INPUT,
      code: "dx-b!",
    });

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error without calling Supabase when timezone is invalid", async () => {
    const result = await createAirportAction({
      ...VALID_INPUT,
      timezone: "Not/AZone",
    });

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should map a 23505 unique violation to DUPLICATE_CODE", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });

    const result = await createAirportAction(VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: {
        code: "DUPLICATE_CODE",
        message: "An airport with this code already exists.",
      },
    });
  });

  it("should map any other Postgres error to a generic INTERNAL_ERROR", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "23502", message: "not null violation" },
    });

    const result = await createAirportAction(VALID_INPUT);

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

    await expect(createAirportAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(fromMock).not.toHaveBeenCalled();
  });
});
