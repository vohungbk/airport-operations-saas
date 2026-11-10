import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/bookings/components/change-booking-status-dialog", () => ({
  ChangeBookingStatusDialog: () => "STATUS_DIALOG",
}));

import { BookingDetail } from "@/features/bookings/components/booking-detail";
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
  props: { canManage?: boolean; canViewRevenue?: boolean; defaultTab?: "overview" | "flight" | "photos" } = {},
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
