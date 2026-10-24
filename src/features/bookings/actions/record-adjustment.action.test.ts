import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getRevenueMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
);

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/bookings/lib/get-booking-revenue", () => ({ getBookingRevenue: getRevenueMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: rpcMock }) }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { recordAdjustmentAction } from "@/features/bookings/actions/record-adjustment.action";
import { FINANCE_ADJUSTMENT_PERMISSIONS } from "@/lib/auth/permissions";

const BOOKING_ID = "f0000000-0000-0000-0000-000000000025";

const booking = (change: Record<string, unknown> = {}) => ({
  id: BOOKING_ID,
  booking_number: "BK-00025",
  status: "completed",
  revenue_case: "standard",
  revenue_flag: null,
  gross_revenue: 450,
  ...change,
});

const input = (change: Record<string, unknown> = {}) => ({
  type: "partial_refund",
  amount: 50,
  reason: "The harness was worn",
  ...change,
});

describe("recordAdjustmentAction", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "operations_manager" });
    getRevenueMock.mockReset();
    getRevenueMock.mockResolvedValue(booking());
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: {}, error: null });
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
  });

  it("should record the adjustment through the database function and go back to Booking revenue (AC06, AC07)", async () => {
    await expect(recordAdjustmentAction(BOOKING_ID, input())).rejects.toThrow(`REDIRECT:/bookings/${BOOKING_ID}/revenue`);

    expect(rpcMock).toHaveBeenCalledWith("add_booking_adjustment", {
      p_booking_id: BOOKING_ID,
      p_type: "partial_refund",
      p_amount: 50,
      p_reason: "The harness was worn",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/bookings/${BOOKING_ID}/revenue`);
  });

  it("should check the permission before anything is read (AC02)", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(recordAdjustmentAction(BOOKING_ID, input())).rejects.toThrow("REDIRECT:/forbidden");
    expect(requireAnyPermissionMock).toHaveBeenCalledWith(FINANCE_ADJUSTMENT_PERMISSIONS);
    expect(getRevenueMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should answer not found for a booking that is unknown or hidden by RLS", async () => {
    getRevenueMock.mockResolvedValue(null);

    const result = await recordAdjustmentAction(BOOKING_ID, input());

    expect(result.error?.code).toBe("NOT_FOUND");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["not completed", { revenue_case: null, gross_revenue: null }],
    ["cancelled", { revenue_case: "cancelled", gross_revenue: 0 }],
    ["refunded in full", { gross_revenue: 0 }],
  ])("should answer a conflict and not call the database for a booking that is %s", async (_name, change) => {
    getRevenueMock.mockResolvedValue(booking(change));

    const result = await recordAdjustmentAction(BOOKING_ID, input());

    expect(result.error?.code).toBe("CONFLICT");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing type", { type: undefined }, "type"],
    ["a type that is not in the list", { type: "bonus" }, "type"],
    ["an amount of zero", { amount: 0 }, "amount"],
    ["a negative amount", { amount: -1 }, "amount"],
    ["an amount above the gross revenue", { amount: 450.01 }, "amount"],
    ["an amount sent as text", { amount: "50" }, "amount"],
    ["an empty reason", { reason: "   " }, "reason"],
  ])("should refuse %s with a message on the field, and not call the database (AC03 to AC05)", async (_name, change, field) => {
    const result = await recordAdjustmentAction(BOOKING_ID, input(change));

    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({ code: "VALIDATION_ERROR", field });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should check the amount against the gross revenue the server reads, not a number from the browser", async () => {
    getRevenueMock.mockResolvedValue(booking({ gross_revenue: 40 }));

    const result = await recordAdjustmentAction(BOOKING_ID, input({ amount: 50 }));

    expect(result.error).toMatchObject({ code: "VALIDATION_ERROR", field: "amount" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["42501", "FORBIDDEN"],
    ["BA003", "VALIDATION_ERROR"],
    ["BA004", "CONFLICT"],
    ["XX000", "INTERNAL_ERROR"],
  ])("should map the database error %s to %s, without the database text, and not go back", async (code, mapped) => {
    rpcMock.mockResolvedValue({ data: null, error: { code, message: "raw database text" } });

    const result = await recordAdjustmentAction(BOOKING_ID, input());

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe(mapped);
    expect(result.error?.message).not.toContain("raw database text");
    expect(redirectMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
