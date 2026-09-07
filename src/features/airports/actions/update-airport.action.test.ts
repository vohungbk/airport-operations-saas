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

import { updateAirportAction } from "@/features/airports/actions/update-airport.action";

const ADMIN_USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

const VALID_INPUT = {
  name: "Dubai International Airport",
  city: "Dubai",
  country: "United Arab Emirates",
  timezone: "Asia/Dubai",
};

describe("updateAirportAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(ADMIN_USER);
    maybeSingleMock.mockReset();
    selectMock.mockClear();
    eqMock.mockClear();
    updateMock.mockClear();
    fromMock.mockClear();
  });

  it("should update the airport and redirect to /airports/[id] on success", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "airport-1" },
      error: null,
    });

    await expect(
      updateAirportAction("airport-1", VALID_INPUT),
    ).rejects.toThrow("REDIRECT:/airports/airport-1");

    expect(requirePermissionMock).toHaveBeenCalledWith("airports:manage");
    expect(fromMock).toHaveBeenCalledWith("airports");
    expect(updateMock).toHaveBeenCalledWith(VALID_INPUT);
    expect(eqMock).toHaveBeenCalledWith("id", "airport-1");
  });

  it("should never accept a code field, even if one is injected into the input", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: "airport-1" },
      error: null,
    });

    await expect(
      updateAirportAction("airport-1", {
        ...VALID_INPUT,
        code: "ATTACKER-CHANGED-CODE",
      }),
    ).rejects.toThrow("REDIRECT:/airports/airport-1");

    expect(updateMock).toHaveBeenCalledWith(VALID_INPUT);
  });

  it("should return a validation error without calling Supabase when name is missing", async () => {
    const withoutName: Record<string, unknown> = { ...VALID_INPUT };
    delete withoutName.name;

    const result = await updateAirportAction("airport-1", withoutName);

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error without calling Supabase when city is missing", async () => {
    const withoutCity: Record<string, unknown> = { ...VALID_INPUT };
    delete withoutCity.city;

    const result = await updateAirportAction("airport-1", withoutCity);

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error without calling Supabase when country is missing", async () => {
    const withoutCountry: Record<string, unknown> = { ...VALID_INPUT };
    delete withoutCountry.country;

    const result = await updateAirportAction("airport-1", withoutCountry);

    expect(result.success).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error without calling Supabase when timezone is invalid", async () => {
    const result = await updateAirportAction("airport-1", {
      ...VALID_INPUT,
      timezone: "Not/AZone",
    });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return NOT_FOUND when the airport id does not match any row", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await updateAirportAction("missing-id", VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Airport not found." },
    });
  });

  it("should map a 23505 unique violation to DUPLICATE_CODE", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });

    const result = await updateAirportAction("airport-1", VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: {
        code: "DUPLICATE_CODE",
        message: "An airport with this code already exists.",
      },
    });
  });

  it("should map any other Postgres error to a generic INTERNAL_ERROR", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { code: "23502", message: "not null violation" },
    });

    const result = await updateAirportAction("airport-1", VALID_INPUT);

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
      updateAirportAction("airport-1", VALID_INPUT),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(fromMock).not.toHaveBeenCalled();
  });
});
