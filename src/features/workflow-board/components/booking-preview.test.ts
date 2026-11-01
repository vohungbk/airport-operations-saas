import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The side panel uses the router, which a server render does not have; the content is what is tested.
vi.mock("@/features/workflow-board/components/preview-sheet", () => ({
  PreviewSheet: ({ children, closeHref }: { children: ReactNode; closeHref: string }) =>
    createElement("aside", { "data-close-href": closeHref }, children),
}));

import { BookingPreview } from "@/features/workflow-board/components/booking-preview";
import type { BookingDetailItem } from "@/features/bookings/lib/get-bookings";

const BOOKING = {
  id: "c0000000-0000-0000-0000-000000000001",
  booking_number: "BK-2026-000123",
  status: "assigned",
  partner: { id: "p1", name: "Emirates Rent A Car", code: "EK" },
  airport: { id: "a1", code: "DXB", name: "Dubai", timezone: "Asia/Dubai" },
  flight: { flight_number: "EK 203" },
} as unknown as BookingDetailItem;

const EVENTS = {
  items: [
    {
      id: "e1",
      from_status: null,
      to_status: "pending" as const,
      notes: null,
      created_at: "2026-10-24T08:08:00Z",
      event_type: "created" as const,
      actor_name: "Omar Haddad",
      from_seat_serial: null,
      to_seat_serial: null,
      changes: null,
    },
  ],
  truncated: false,
};

function render(booking = BOOKING) {
  return renderToStaticMarkup(
    createElement(BookingPreview, { booking, events: EVENTS, closeHref: "/admin?date=2026-10-24" }),
  );
}

describe("BookingPreview", () => {
  it("should show the booking number, who it is for and the step it is at", () => {
    const html = render();

    expect(html).toContain("BK-2026-000123");
    expect(html).toContain("Emirates Rent A Car · EK 203 · DXB");
    expect(html).toContain("Current step");
    expect(html).toContain("Assigned");
  });

  it("should show the step history of the booking", () => {
    const html = render();

    expect(html).toContain("Step history");
    expect(html).toContain("Booking created");
  });

  it("should link to the booking and hand the panel the board address to return to", () => {
    const html = render();

    expect(html).toContain(`href="/bookings/${BOOKING.id}"`);
    expect(html).toContain("Open booking");
    expect(html).toContain('data-close-href="/admin?date=2026-10-24"');
  });

  it("should leave out the parts of the subtitle a booking does not have", () => {
    const html = render({ ...BOOKING, partner: null, flight: null } as unknown as BookingDetailItem);

    expect(html).toContain("DXB");
    expect(html).not.toContain("EK 203");
  });
});
