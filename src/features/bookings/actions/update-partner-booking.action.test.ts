import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: rpcMock,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
    }),
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { updatePartnerBookingAction } from "@/features/bookings/actions/update-partner-booking.action";

const ID = "f0000000-0000-4000-8000-000000000001";

const VALID_INPUT = {
  expected_updated_at: "2026-09-01T00:00:00.000Z",
  pickup_at: "2026-09-02T08:00",
  return_at: "2026-09-05T08:00",
  notes: "Meet at gate 3",
};

describe("updatePartnerBookingAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ role: "partner_user" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: { id: ID }, error: null });
    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({
      data: { id: ID, airport: { timezone: "Asia/Dubai" } },
      error: null,
    });
  });

  it("should call update_partner_booking with UTC times and redirect to the booking", async () => {
    await expect(updatePartnerBookingAction(ID, VALID_INPUT)).rejects.toThrow(
      `REDIRECT:/bookings/${ID}`,
    );

    expect(requirePermissionMock).toHaveBeenCalledWith("bookings:manage_own_partner");
    expect(rpcMock).toHaveBeenCalledWith(
      "update_partner_booking",
      expect.objectContaining({
        p_booking_id: ID,
        p_expected_updated_at: VALID_INPUT.expected_updated_at,
        p_pickup_at: "2026-09-02T04:00:00.000Z",
        p_return_at: "2026-09-05T04:00:00.000Z",
        p_notes: "Meet at gate 3",
      }),
    );
  });

  it("should never send a seat, partner, status or rate, even if the client adds them", async () => {
    await expect(
      updatePartnerBookingAction(ID, {
        ...VALID_INPUT,
        assigned_seat_id: "e0000000-0000-0000-0000-000000000001",
        partner_id: "b0000000-0000-0000-0000-000000000002",
        status: "confirmed",
        daily_rate: "1",
      }),
    ).rejects.toThrow("REDIRECT");

    const args = rpcMock.mock.calls[0][1];
    for (const key of ["p_assigned_seat_id", "p_partner_id", "p_status", "p_daily_rate"]) {
      expect(args).not.toHaveProperty(key);
    }
  });

  it("should return NOT_FOUND and not call the RPC when the booking is hidden (another partner's) or missing", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await updatePartnerBookingAction(ID, VALID_INPUT);

    expect(result.error?.code).toBe("NOT_FOUND");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should return a validation error for a bad id or bad input without touching the database", async () => {
    expect((await updatePartnerBookingAction("nope", VALID_INPUT)).error?.code).toBe(
      "VALIDATION_ERROR",
    );
    expect(
      (await updatePartnerBookingAction(ID, { ...VALID_INPUT, return_at: "2026-09-01T08:00" })).error
        ?.code,
    ).toBe("VALIDATION_ERROR");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["BK004", "STALE_DATA"],
    ["BK006", "NO_SEAT_AVAILABLE"],
    ["55000", "INVALID_TRANSITION"],
    ["BK002", "SEAT_CONFLICT"],
    ["P0002", "NOT_FOUND"],
    ["42501", "FORBIDDEN"],
  ])("should map database error %s to %s", async (dbCode, code) => {
    rpcMock.mockResolvedValue({ data: null, error: { code: dbCode, message: "x" } });

    expect((await updatePartnerBookingAction(ID, VALID_INPUT)).error?.code).toBe(code);
  });

  it("should propagate the guard's redirect for a user without the permission", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(updatePartnerBookingAction(ID, VALID_INPUT)).rejects.toThrow("REDIRECT:/forbidden");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
