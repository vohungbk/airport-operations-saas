import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getRevenueMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/bookings/lib/get-booking-revenue", () => ({ getBookingRevenue: getRevenueMock }));
const formProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock("@/features/bookings/components/adjustment-form", () => ({
  // The form is a client component with its own tests; the page is checked by what it hands it.
  AdjustmentForm: (props: Record<string, unknown>) => {
    formProps.current = props;
    return "FORM";
  },
}));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import AdjustmentPage from "@/app/(dashboard)/bookings/[id]/adjustment/page";
import { FINANCE_ADJUSTMENT_PERMISSIONS, hasAnyPermission } from "@/lib/auth/permissions";

const BOOKING_ID = "f0000000-0000-0000-0000-000000000025";

const completed = {
  id: BOOKING_ID,
  booking_number: "BK-00025",
  status: "completed",
  daily_rate: 90,
  paid_days: 3,
  rental_days: 3,
  gross_revenue: 270,
  adjustments_total: 0,
  partner_share: 135,
  platform_share: 135,
  launch_credit: 54,
  launch_credit_balance: 54,
  revenue_case: "standard",
  revenue_flag: null,
  terms: null,
};

const render = async () =>
  renderToStaticMarkup(await AdjustmentPage({ params: Promise.resolve({ id: BOOKING_ID }) }));

/**
 * VI-F04-S09 (NAV-1): the Adjustment form opens from Booking revenue, for a role that may add an
 * adjustment. Nothing is written from here; the fields and Save are VI-F04-S10.
 */
describe("AdjustmentPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "operations_manager" });
    getRevenueMock.mockReset();
    getRevenueMock.mockResolvedValue(completed);
    formProps.current = null;
    notFoundMock.mockClear();
  });

  it("should open the adjustment form for a completed rental, with its current figures (AC02)", async () => {
    const html = await render();

    expect(getRevenueMock).toHaveBeenCalledWith(BOOKING_ID);
    expect(html).toContain("Add adjustment");
    expect(html).toContain("BK-00025");
    expect(html).toContain("270.00");
    expect(html).toContain("135.00");
    expect(html).toContain("FORM");
  });

  it("should hand the form the booking and the gross revenue it has now as the most an adjustment can be (AC04)", async () => {
    getRevenueMock.mockResolvedValue({ ...completed, gross_revenue: 220, adjustments_total: -50 });

    await render();

    expect(formProps.current).toEqual({ bookingId: BOOKING_ID, maxAmount: 220 });
  });

  it("should check the permission to add an adjustment before reading anything (AC01)", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(requireAnyPermissionMock).toHaveBeenCalledWith(FINANCE_ADJUSTMENT_PERMISSIONS);
    expect(getRevenueMock).not.toHaveBeenCalled();
  });

  it.each([
    ["admin", true],
    ["operations_manager", true],
    ["partner_user", false],
    ["technician", false],
  ])("should give the permission to %s: %s", (role, expected) => {
    expect(hasAnyPermission(role as never, FINANCE_ADJUSTMENT_PERMISSIONS)).toBe(expected);
  });

  it("should answer not found for a booking that is unknown or that RLS hides", async () => {
    getRevenueMock.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NOT_FOUND");
  });

  it.each([
    ["not completed", { revenue_case: null, gross_revenue: null }],
    ["cancelled", { revenue_case: "cancelled", gross_revenue: 0 }],
    ["a no-show", { revenue_case: "no_show", gross_revenue: 0 }],
    ["flagged for no duration", { revenue_flag: "invalid_duration", gross_revenue: null }],
    ["refunded in full", { gross_revenue: 0, adjustments_total: -270 }],
  ])("should say there is nothing to adjust on a booking that is %s, and show no form", async (_name, change) => {
    getRevenueMock.mockResolvedValue({ ...completed, ...change });

    const html = await render();

    expect(html).toContain("Nothing to adjust");
    expect(html).not.toContain("Revenue of this booking now");
    expect(html).not.toContain("FORM");
    expect(formProps.current).toBeNull();
  });

  it("should let the user cancel back to Booking revenue (NAV-3) when there is nothing to adjust", async () => {
    getRevenueMock.mockResolvedValue({ ...completed, revenue_case: null, gross_revenue: null });

    expect(await render()).toContain(`href="/bookings/${BOOKING_ID}/revenue"`);
  });

  it("should write nothing itself: the page imports no action and calls no write", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/app/(dashboard)/bookings/[id]/adjustment/page.tsx", "utf8");

    expect(source).not.toMatch(/\.action"|"use server"|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
  });
});
