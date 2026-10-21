import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const getAirportTimezoneMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock, from: fromMock })),
}));

vi.mock("@/features/bookings/lib/get-airport-timezone", () => ({
  getAirportTimezone: getAirportTimezoneMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { createPartnerBookingAction } from "@/features/bookings/actions/create-partner-booking.action";

const PARTNER_USER = {
  id: "user-1",
  email: "partner@example.com",
  full_name: "Partner User",
  role: "partner_user" as const,
  partner_id: "b0000000-0000-0000-0000-000000000001",
  is_active: true,
};

const BOOKING_ID = "f0000000-0000-4000-8000-000000000099";

const VALID_INPUT = {
  airport_id: "a0000000-0000-0000-0000-000000000001",
  seat_category_id: "c0000000-0000-0000-0000-000000000001",
  daily_rate: "75",
  pickup_at: "2026-09-01T08:00",
  return_at: "2026-09-04T08:00",
};

describe("createPartnerBookingAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(PARTNER_USER);
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: { id: BOOKING_ID }, error: null });
    fromMock.mockClear();
    getAirportTimezoneMock.mockReset();
    getAirportTimezoneMock.mockResolvedValue({ timezone: "Asia/Dubai" });
  });

  it("should call create_partner_booking with UTC times and redirect to the new booking", async () => {
    await expect(createPartnerBookingAction(VALID_INPUT)).rejects.toThrow(
      `REDIRECT:/bookings/${BOOKING_ID}`,
    );

    expect(requirePermissionMock).toHaveBeenCalledWith("bookings:manage_own_partner");
    expect(rpcMock).toHaveBeenCalledWith(
      "create_partner_booking",
      expect.objectContaining({
        p_airport_id: VALID_INPUT.airport_id,
        p_pickup_at: "2026-09-01T04:00:00.000Z",
        p_return_at: "2026-09-04T04:00:00.000Z",
        p_daily_rate: 75,
      }),
    );
  });

  it("should never send a partner, a seat, a status or a number, even if the client adds them", async () => {
    await expect(
      createPartnerBookingAction({
        ...VALID_INPUT,
        partner_id: "b0000000-0000-0000-0000-000000000002",
        assigned_seat_id: "e0000000-0000-0000-0000-000000000001",
        status: "confirmed",
        booking_number: "BK-99999",
      }),
    ).rejects.toThrow("REDIRECT");

    const args = rpcMock.mock.calls[0][1];
    for (const key of ["p_partner_id", "p_assigned_seat_id", "p_status", "p_booking_number"]) {
      expect(args).not.toHaveProperty(key);
    }
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return a validation error without calling the RPC for bad input", async () => {
    const result = await createPartnerBookingAction({ ...VALID_INPUT, daily_rate: "-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect for a user without the permission", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(createPartnerBookingAction(VALID_INPUT)).rejects.toThrow("REDIRECT:/forbidden");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should say no seat is available, without naming anyone, when the capacity is used up (BK006)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "BK006", message: "internal" } });

    const result = await createPartnerBookingAction(VALID_INPUT);

    expect(result.error?.code).toBe("NO_SEAT_AVAILABLE");
    expect(result.error?.message).not.toContain("internal");
  });

  it("should return FORBIDDEN when the database says the caller is not a partner user (42501)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "42501", message: "Not allowed" } });

    const result = await createPartnerBookingAction(VALID_INPUT);

    expect(result.error?.code).toBe("FORBIDDEN");
  });

  it("should return a clear NOT_FOUND error when the airport cannot be found", async () => {
    getAirportTimezoneMock.mockResolvedValue({ timezone: null });

    const result = await createPartnerBookingAction(VALID_INPUT);

    expect(result.error?.code).toBe("NOT_FOUND");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
