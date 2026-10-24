import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getRevenueMock = vi.hoisted(() => vi.fn());
const getAdjustmentsMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/bookings/lib/get-booking-revenue", () => ({ getBookingRevenue: getRevenueMock }));
vi.mock("@/features/bookings/lib/get-booking-adjustments", () => ({
  getBookingAdjustments: getAdjustmentsMock,
}));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import BookingRevenuePage from "@/app/(dashboard)/bookings/[id]/revenue/page";
import { FINANCE_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";

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
  terms: {
    partner_share_percent: 30,
    platform_share_percent: 70,
    launch_partner_share_percent: 50,
    effective_from: "2026-01-01",
  },
};

const render = async () =>
  renderToStaticMarkup(await BookingRevenuePage({ params: Promise.resolve({ id: BOOKING_ID }) }));

/**
 * VI-F04-S08: how the revenue of a booking was calculated. The finance permission is checked
 * before anything is read; RLS decides which bookings a partner user can open.
 */
describe("BookingRevenuePage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "operations_manager" });
    getRevenueMock.mockReset();
    getRevenueMock.mockResolvedValue(completed);
    getAdjustmentsMock.mockReset();
    getAdjustmentsMock.mockResolvedValue([]);
    notFoundMock.mockClear();
  });

  it("should show the breakdown of a completed booking (AC02)", async () => {
    const html = await render();

    expect(getRevenueMock).toHaveBeenCalledWith(BOOKING_ID);
    expect(html).toContain("BK-00025");
    expect(html).toContain("Gross revenue");
    expect(html).toContain("270.00");
    expect(html).toContain("135.00 (50%)");
    expect(html).toContain("54.00 added");
  });

  it("should check the finance permission before reading anything (AC01)", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(requireAnyPermissionMock).toHaveBeenCalledWith(FINANCE_ACCESS_PERMISSIONS);
    expect(getRevenueMock).not.toHaveBeenCalled();
  });

  it("should let a partner user open a booking of their own partner", async () => {
    requireAnyPermissionMock.mockResolvedValue({ id: "u-2", role: "partner_user" });

    expect(await render()).toContain("Booking revenue");
  });

  it("should show the empty state for a booking that is not completed (AC01)", async () => {
    getRevenueMock.mockResolvedValue({ ...completed, status: "confirmed", revenue_case: null, paid_days: 0, rental_days: null, gross_revenue: null, partner_share: null, platform_share: null, launch_credit: 0, launch_credit_balance: null, terms: null });

    const html = await render();

    expect(html).toContain("No revenue yet");
    expect(html).not.toContain("Gross revenue");
  });

  it("should answer not found for a booking that is unknown or that RLS hides", async () => {
    getRevenueMock.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NOT_FOUND");
  });

  it.each([
    ["admin", true],
    ["operations_manager", true],
    ["partner_user", false],
  ])("should offer Add adjustment to %s: %s, for a completed rental (VI-F04-S09 AC01)", async (role, offered) => {
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role });

    const html = await render();

    expect(html.includes("Add adjustment")).toBe(offered);
    if (offered) expect(html).toContain(`href="/bookings/${BOOKING_ID}/adjustment"`);
  });

  it.each([
    ["not completed", { revenue_case: null, gross_revenue: null }],
    ["cancelled", { revenue_case: "cancelled", gross_revenue: 0 }],
    ["flagged for no duration", { revenue_flag: "invalid_duration", gross_revenue: null }],
  ])("should not offer Add adjustment on a booking that is %s: nothing to correct", async (_name, change) => {
    getRevenueMock.mockResolvedValue({ ...completed, ...change });

    expect(await render()).not.toContain("Add adjustment");
  });

  it("should list the adjustments recorded to the operations team (VI-F04-S10, R16)", async () => {
    getRevenueMock.mockResolvedValue({ ...completed, gross_revenue: 220, adjustments_total: -50 });
    getAdjustmentsMock.mockResolvedValue([
      { id: "a-1", type: "partial_refund", amount: 50, reason: "The harness was worn", created_at: "2026-10-24T10:00:00Z" },
    ]);

    const html = await render();

    expect(getAdjustmentsMock).toHaveBeenCalledWith(BOOKING_ID);
    expect(html).toContain("Adjustments recorded");
    expect(html).toContain("The harness was worn");
    expect(html).toContain("Partial refund: -50.00");
    expect(html).toContain("(after 50.00 of adjustments)");
  });

  it("should say no adjustment was recorded when the list is empty", async () => {
    expect(await render()).toContain("No adjustment has been recorded");
  });

  it("should show a partner user the total of the adjustments but not the list or the reasons, and not read them", async () => {
    requireAnyPermissionMock.mockResolvedValue({ id: "u-2", role: "partner_user" });
    getRevenueMock.mockResolvedValue({ ...completed, gross_revenue: 220, adjustments_total: -50 });

    const html = await render();

    expect(getAdjustmentsMock).not.toHaveBeenCalled();
    expect(html).not.toContain("Adjustments recorded");
    expect(html).toContain("-50.00");
  });

  it("should link back to the booking and offer no way to change anything", async () => {
    const html = await render();

    expect(html).toContain(`href="/bookings/${BOOKING_ID}"`);
    expect(html).not.toMatch(/<input|<button|<form/);
  });

  it("should import no action that writes", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/app/(dashboard)/bookings/[id]/revenue/page.tsx", "utf8");

    expect(source).not.toMatch(/\.action"|"use server"|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
  });
});
