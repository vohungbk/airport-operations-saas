import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getBookingByIdMock = vi.hoisted(() => vi.fn());
const getBookingEventsMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/bookings/lib/get-booking-by-id", () => ({
  getBookingById: getBookingByIdMock,
}));

vi.mock("@/features/bookings/lib/get-booking-events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/bookings/lib/get-booking-events")>()),
  getBookingEvents: getBookingEventsMock,
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import BookingWorkflowPage from "@/app/(dashboard)/bookings/[id]/workflow/page";

const ID = "f0000000-0000-4000-8000-000000000001";

const BOOKING = {
  id: ID,
  booking_number: "BK-2026-000123",
  status: "assigned",
  pickup_at: "2026-10-24T08:00:00Z",
  partner: { id: "p1", name: "Emirates Rent A Car", code: "EK" },
  airport: { id: "a1", code: "DXB", name: "Dubai", timezone: "Asia/Dubai" },
  flight: { flight_number: "EK 203" },
  seat: { id: "s1", serial_number: "SEAT-0001", status: "reserved" },
};

const EVENTS = {
  items: [
    {
      id: "e2",
      from_status: "confirmed",
      to_status: "assigned",
      notes: "Seat reserved for this booking.",
      created_at: "2026-10-24T09:05:00Z",
      event_type: "status_changed",
      actor_name: "Priya Nair",
      from_seat_serial: null,
      to_seat_serial: null,
      changes: null,
    },
  ],
  truncated: false,
};

const open = async () => renderToStaticMarkup(await BookingWorkflowPage({ params: Promise.resolve({ id: ID }) }));

describe("BookingWorkflowPage (CO-F08-S06)", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ role: "admin" });
    getBookingByIdMock.mockReset();
    getBookingByIdMock.mockResolvedValue(BOOKING);
    getBookingEventsMock.mockReset();
    getBookingEventsMock.mockResolvedValue(EVENTS);
  });

  it("should guard the page with either booking permission before anything is read (AC01)", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(open()).rejects.toThrow("REDIRECT:/forbidden");
    expect(requireAnyPermissionMock).toHaveBeenCalledWith(["bookings:manage", "bookings:view_own_partner"]);
    expect(getBookingByIdMock).not.toHaveBeenCalled();
    expect(getBookingEventsMock).not.toHaveBeenCalled();
  });

  it("should show the step, its history and the seat status of the booking (AC01, AC02)", async () => {
    const html = await open();

    expect(html).toContain("BK-2026-000123");
    expect(html).toContain("Emirates Rent A Car · EK 203 · DXB · 24 Oct 2026");
    expect(html).toContain("Step 3 of 5");
    expect(html).toContain("Step history");
    expect(html).toContain("Priya Nair");
    expect(html).toContain("Seat reserved for this booking.");
    expect(html).toContain("Reserved");
  });

  it("should show the deadline of the next step and flag it overdue to an internal role (CO-F08-S07 AC01)", async () => {
    const html = await open();

    expect(html).toContain("Deadline");
    expect(html).toContain("24 Oct 2026 · 11:00 GST");
    expect(html).toContain("Overdue by");
  });

  it("should show the deadline without the Overdue flag while it is still ahead (CO-F08-S07 AC01)", async () => {
    getBookingByIdMock.mockResolvedValue({ ...BOOKING, pickup_at: "2999-01-01T08:00:00Z" });

    const html = await open();

    expect(html).toContain("Deadline");
    expect(html).not.toContain("Overdue");
  });

  it("should not show a deadline to a partner user (CO-F08-S07)", async () => {
    requireAnyPermissionMock.mockResolvedValue({ role: "partner_user" });

    const html = await open();

    expect(html).not.toContain("Deadline");
    expect(html).not.toContain("Overdue");
  });

  it("should show the tab bar with Workflow as the open tab and links to the other tabs", async () => {
    const html = await open();

    expect(html).toContain('aria-label="Booking sections"');
    expect(html).toContain(`href="/bookings/${ID}"`);
    expect(html).toContain(`href="/bookings/${ID}?tab=flight"`);
    expect(html).toContain(`href="/bookings/${ID}?tab=timeline"`);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("should show the same not-found page for a booking that is missing or hidden by RLS (AC02)", async () => {
    getBookingByIdMock.mockResolvedValue(null);

    await expect(open()).rejects.toThrow("NOT_FOUND");
  });

  it("should show a partner user the not-found page, not the history, for another partner's booking (CO-F08-S09 AC02)", async () => {
    requireAnyPermissionMock.mockResolvedValue({ role: "partner_user" });
    getBookingByIdMock.mockResolvedValue(null);
    notFoundMock.mockClear();

    await expect(open()).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it.each(["admin", "operations_manager"])("should lead %s back to the Workflow board (AC03)", async (role) => {
    requireAnyPermissionMock.mockResolvedValue({ role });

    const html = await open();

    expect(html).toContain('href="/admin"');
    expect(html).toContain("Back to Workflow board");
  });

  it("should lead a partner user back to the booking, since the board is not theirs to open (AC03)", async () => {
    requireAnyPermissionMock.mockResolvedValue({ role: "partner_user" });

    const html = await open();

    expect(html).toContain(`href="/bookings/${ID}"`);
    expect(html).not.toContain('href="/admin"');
  });

  it("should still show a booking with no events and no seat", async () => {
    getBookingByIdMock.mockResolvedValue({ ...BOOKING, seat: null });
    getBookingEventsMock.mockResolvedValue({ items: [], truncated: false });

    const html = await open();

    expect(html).toContain("No events recorded.");
    expect(html).toContain("Seat status");
  });

  it("should not mark a current step for a cancelled booking", async () => {
    getBookingByIdMock.mockResolvedValue({ ...BOOKING, status: "cancelled", seat: null });

    const html = await open();

    expect(html).not.toContain('aria-current="step"');
  });
});
