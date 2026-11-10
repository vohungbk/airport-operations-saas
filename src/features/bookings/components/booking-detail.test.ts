import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/bookings/actions/record-adjustment.action", () => ({ recordAdjustmentAction: vi.fn() }));
vi.mock("@/features/bookings/components/change-booking-status-dialog", () => ({
  ChangeBookingStatusDialog: () => "STATUS_DIALOG",
}));

import { BookingDetail } from "@/features/bookings/components/booking-detail";
import type { BookingRevenueData } from "@/features/bookings/components/booking-revenue-tab";
import type { BookingDetailItem } from "@/features/bookings/lib/get-bookings";

const ID = "f0000000-0000-4000-8000-000000000001";

const booking = (status: string, extra: Record<string, unknown> = {}) =>
  ({
    id: ID,
    booking_number: "BK-00001",
    status,
    pickup_at: "2026-09-01T04:00:00.000Z",
    return_at: "2026-09-04T04:00:00.000Z",
    daily_rate: 75,
    notes: "Gate code 4411",
    partner: { id: "p", name: "ERAC", code: "ERAC" },
    airport: { id: "a", code: "DXB", name: "Dubai", timezone: "Asia/Dubai" },
    seat: null,
    category: { id: "c", name: "Toddler" },
    technician: null,
    flight: null,
    jobs: [],
    ...extra,
  }) as unknown as BookingDetailItem;

const render = (
  status: string,
  props: {
    canManage?: boolean;
    canViewRevenue?: boolean;
    defaultTab?: "overview" | "flight" | "revenue" | "photos";
    revenue?: BookingRevenueData | null;
  } = {},
  extra: Record<string, unknown> = {},
) =>
  renderToStaticMarkup(
    createElement(BookingDetail, {
      booking: booking(status, extra),
      events: { items: [], truncated: false },
      canManage: false,
      ...props,
    }),
  );

describe("BookingDetail header (UI-F06-T03 AC01, AC05, AC06)", () => {
  it("should show the booking, its partner, the status badge and the five tabs for a manager", () => {
    const html = render("confirmed", { canManage: true, canViewRevenue: true });

    expect(html).toContain("BK-00001 · ERAC");
    expect(html).toContain("Allocated");
    for (const name of ["Overview", "Flight", "Revenue", "Timeline", "Photos"]) {
      expect(html).toContain(`>${name}<`);
    }
  });

  it("should show Edit booking and the status dialog to a manager", () => {
    const html = render("confirmed", { canManage: true });

    expect(html).toContain(`href="/bookings/${ID}/edit"`);
    expect(html).toContain("Edit booking");
    expect(html).toContain("STATUS_DIALOG");
  });

  it("should show a partner user no Edit button and no internal notes", () => {
    const html = render("pending", { canManage: false, canViewRevenue: true });

    expect(html).not.toContain("/edit");
    expect(html).not.toContain("Internal notes");
    expect(html).not.toContain("Gate code 4411");
  });

  it("should not show the Revenue tab to a technician", () => {
    expect(render("assigned", { canManage: false, canViewRevenue: false })).not.toContain(">Revenue<");
  });

  it.each(["completed", "cancelled", "no_show"])("should offer a manager no Edit and no status dialog for a %s booking", (status) => {
    const html = render(status, { canManage: true });

    expect(html).not.toContain("/edit");
    expect(html).not.toContain("STATUS_DIALOG");
  });
});

describe("BookingDetail Overview (UI-F06-T03 AC02, AC03, AC09)", () => {
  it("should show the groups with the airport time zone on every time", () => {
    const html = render("confirmed", { canManage: true });

    for (const title of ["Booking information", "Pickup and return", "Child", "Seat and team", "Price"]) {
      expect(html).toContain(title);
    }
    expect(html).toContain("Asia/Dubai");
    expect(html).toContain("Gate code 4411");
  });

  it("should list the 13 steps and mark the current one", () => {
    const html = render("family_ready");

    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html.match(/<li /g)).toHaveLength(13);
    expect(html).toContain("Completed · New");
  });

  it("should say a cancelled booking is read only", () => {
    const html = render("cancelled", { canManage: true });

    expect(html).toContain("Booking cancelled");
    expect(html).toContain("This booking is read only.");
  });

  it("should show the flight alert for an early flight and none for a flight on time", () => {
    const flight = (estimated: string) => ({
      flight_number: "EK 203",
      status: "scheduled",
      terminal: "3",
      scheduled_arrival_at: "2026-09-01T12:30:00.000Z",
      estimated_arrival_at: estimated,
      actual_arrival_at: null,
      delay_minutes: null,
      last_synced_at: "2026-09-01T10:45:00.000Z",
    });

    expect(render("confirmed", {}, { flight: flight("2026-09-01T11:45:00.000Z") })).toContain("ARRIVING 45 MINUTES EARLY");
    expect(render("confirmed", {}, { flight: flight("2026-09-01T12:30:00.000Z") })).not.toContain("ARRIVING");
  });
});

describe("BookingDetail heading (VI-F02-S02)", () => {
  it("should name the Flight tab in the heading when it is open", () => {
    expect(render("pending", { defaultTab: "flight" })).toContain("Booking detail · Flight");
  });

  it("should keep the plain heading on the Overview tab", () => {
    expect(render("pending", { defaultTab: "overview" })).not.toContain("Booking detail · Flight");
  });
});

describe("BookingDetail Revenue tab (UI-F06-T04)", () => {
  const row = {
    id: ID,
    booking_number: "BK-00001",
    status: "completed",
    daily_rate: 20,
    paid_days: 6,
    rental_days: 8,
    gross_revenue: 100,
    adjustments_total: -20,
    partner_share: 60,
    platform_share: 40,
    launch_credit: 0,
    launch_credit_balance: null,
    revenue_case: "standard",
    revenue_flag: null,
    terms: { partner_share_percent: 60, platform_share_percent: 40, launch_partner_share_percent: 50, effective_from: "2026-01-01" },
  } as unknown as BookingRevenueData["row"];
  const adjustment = [{
    id: "a-1",
    type: "partial_refund",
    amount: 20,
    reason: "Early return refund",
    created_at: "2026-10-24T12:15:00.000Z",
    after_settlement: false,
    creator: { full_name: "Priya Nair" },
  }] as unknown as BookingRevenueData["adjustments"];

  it("should show the breakdown, the adjustments and Add adjustment to a manager (AC01, AC04, AC06)", () => {
    const html = render("completed", { canManage: true, canViewRevenue: true, defaultTab: "revenue", revenue: { row, adjustments: adjustment, canAdjust: true } });

    expect(html).toContain("Revenue breakdown · Verified amounts · USD");
    expect(html).toContain("8 days booked, 6 days paid");
    expect(html).toContain("Adjustments · Net -USD 20.00");
    expect(html).toContain("Add adjustment");
  });

  it("should not offer Add adjustment when the booking cannot have one", () => {
    const html = render("completed", { canManage: true, canViewRevenue: true, defaultTab: "revenue", revenue: { row, adjustments: adjustment, canAdjust: false } });

    expect(html).toContain("Adjustments · Net");
    expect(html).not.toContain("Add adjustment");
  });

  it("should show a partner user the shares only, no adjustments, no Add adjustment and no platform lines (AC08)", () => {
    const html = render("completed", { canViewRevenue: true, defaultTab: "revenue", revenue: { row, adjustments: null, canAdjust: false } });

    expect(html).toContain("Partner share · 60%");
    expect(html).not.toContain("Adjustments ·");
    expect(html).not.toContain("Add adjustment");
    expect(html).not.toContain("Platform share");
    expect(html).not.toContain("Launch-credit effect");
  });

  it("should not show the Revenue content to a role without the Revenue tab, even for ?tab=revenue (AC09)", () => {
    const html = render("completed", { canViewRevenue: false, defaultTab: "revenue", revenue: null });

    expect(html).not.toContain("Revenue breakdown");
    expect(html).toContain("Booking information");
  });
});
