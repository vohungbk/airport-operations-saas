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

import { createBookingAction } from "@/features/bookings/actions/create-booking.action";

const OPS_USER = {
  id: "user-1",
  email: "ops@example.com",
  full_name: "Ops User",
  role: "operations_manager" as const,
  partner_id: null,
  is_active: true,
};

const BOOKING_ID = "f0000000-0000-4000-8000-000000000099";

const VALID_INPUT = {
  partner_id: "b0000000-0000-0000-0000-000000000001",
  airport_id: "a0000000-0000-0000-0000-000000000001",
  seat_category_id: "c0000000-0000-0000-0000-000000000001",
  daily_rate: "75",
  pickup_at: "2026-09-01T08:00",
  return_at: "2026-09-04T08:00",
  assigned_seat_id: "",
};

describe("createBookingAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(OPS_USER);
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: { id: BOOKING_ID }, error: null });
    fromMock.mockClear();
    getAirportTimezoneMock.mockReset();
    getAirportTimezoneMock.mockResolvedValue({ timezone: "Asia/Dubai" });
  });

  it("should call create_booking with UTC times and redirect to the new booking on success", async () => {
    await expect(createBookingAction(VALID_INPUT)).rejects.toThrow(
      `REDIRECT:/bookings/${BOOKING_ID}`,
    );

    expect(requirePermissionMock).toHaveBeenCalledWith("bookings:manage");
    expect(rpcMock).toHaveBeenCalledWith(
      "create_booking",
      expect.objectContaining({
        p_partner_id: VALID_INPUT.partner_id,
        p_pickup_at: "2026-09-01T04:00:00.000Z",
        p_return_at: "2026-09-04T04:00:00.000Z",
        p_daily_rate: 75,
        p_assigned_seat_id: undefined,
      }),
    );
  });

  it("should never insert directly or send status/booking_number", async () => {
    await expect(
      createBookingAction({
        ...VALID_INPUT,
        status: "confirmed",
        booking_number: "BK-99999",
      }),
    ).rejects.toThrow("REDIRECT");

    expect(fromMock).not.toHaveBeenCalled();
    const args = rpcMock.mock.calls[0][1];
    expect(args).not.toHaveProperty("p_status");
    expect(args).not.toHaveProperty("p_booking_number");
  });

  it("should return a validation error without calling the RPC for bad input", async () => {
    const result = await createBookingAction({ ...VALID_INPUT, daily_rate: "-1" });

    expect(result).toEqual({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Check the form and try again." },
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect for a user without bookings:manage", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(createBookingAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should return a clear NOT_FOUND error when the airport cannot be found", async () => {
    getAirportTimezoneMock.mockResolvedValue({ timezone: null });

    const result = await createBookingAction(VALID_INPUT);

    expect(result.error?.code).toBe("NOT_FOUND");
    expect(result.error?.message).toContain("Airport");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should map a seat conflict from the RPC to SEAT_CONFLICT", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "BK002", message: "x" } });

    const result = await createBookingAction({
      ...VALID_INPUT,
      assigned_seat_id: "e0000000-0000-0000-0000-000000000001",
    });

    expect(result).toEqual({
      success: false,
      error: expect.objectContaining({ code: "SEAT_CONFLICT" }),
    });
  });

  it("should map an unexpected RPC error to INTERNAL_ERROR without leaking details", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "secret detail" },
    });

    const result = await createBookingAction(VALID_INPUT);

    expect(result.error?.code).toBe("INTERNAL_ERROR");
    expect(result.error?.message).not.toContain("secret");
  });
});
