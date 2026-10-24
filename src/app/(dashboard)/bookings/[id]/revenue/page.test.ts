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
