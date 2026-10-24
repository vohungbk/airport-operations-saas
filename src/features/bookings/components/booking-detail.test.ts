import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/bookings/components/change-booking-status-dialog", () => ({
  ChangeBookingStatusDialog: () => "STATUS_DIALOG",
}));

import { BookingDetail } from "@/features/bookings/components/booking-detail";
import type { BookingDetailItem } from "@/features/bookings/lib/get-bookings";

const booking = (status: string) =>
  ({
    id: "f0000000-0000-4000-8000-000000000001",
    booking_number: "BK-00001",
    status,
    pickup_at: "2026-09-01T04:00:00.000Z",
    return_at: "2026-09-04T04:00:00.000Z",
    daily_rate: 75,
    partner: { id: "p", name: "ERAC", code: "ERAC" },
    airport: { id: "a", code: "DXB", name: "Dubai", timezone: "Asia/Dubai" },
    seat: null,
    category: { id: "c", name: "Toddler" },
    technician: null,
  }) as unknown as BookingDetailItem;

const render = (status: string, canManage: boolean, canEditOwn: boolean) =>
  renderToStaticMarkup(
    createElement(BookingDetail, {
      booking: booking(status),
      events: { items: [], truncated: false },
      canManage,
      canEditOwn,
    }),
  );

describe("BookingDetail actions (VI-F03-S03)", () => {
  it("should let a partner user edit a pending booking, but not change its status", () => {
    const html = render("pending", false, true);

    expect(html).toContain("/edit");
    expect(html).not.toContain("STATUS_DIALOG");
  });

  it.each(["confirmed", "assigned", "in_progress", "completed", "cancelled", "no_show"])(
    "should offer a partner user no Edit for a %s booking",
    (status) => {
      expect(render(status, false, true)).not.toContain("/edit");
    },
  );

  it("should offer a viewer without either permission no action at all", () => {
    const html = render("pending", false, false);

    expect(html).not.toContain("/edit");
    expect(html).not.toContain("STATUS_DIALOG");
  });

  it("should keep a manager's Edit for a confirmed booking and the status dialog", () => {
    const html = render("confirmed", true, false);

    expect(html).toContain("/edit");
    expect(html).toContain("STATUS_DIALOG");
  });
});

describe("BookingDetail revenue link (VI-F04-S08)", () => {
  const renderWithRevenue = (canViewRevenue: boolean) =>
    renderToStaticMarkup(
      createElement(BookingDetail, {
        booking: booking("completed"),
        events: { items: [], truncated: false },
        canManage: false,
        canEditOwn: false,
        canViewRevenue,
      }),
    );

  it("should link to how the revenue was calculated for a viewer with the finance permission", () => {
    const html = renderWithRevenue(true);

    expect(html).toContain('href="/bookings/f0000000-0000-4000-8000-000000000001/revenue"');
    expect(html).toContain(">Revenue<");
  });

  it("should not link to it for a viewer without the finance permission", () => {
    expect(renderWithRevenue(false)).not.toContain("/revenue");
  });

  it("should not link to it when the prop is not given", () => {
    expect(render("completed", false, false)).not.toContain("/revenue");
  });
});
