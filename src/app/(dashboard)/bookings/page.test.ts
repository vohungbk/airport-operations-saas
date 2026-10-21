import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getBookingsMock = vi.hoisted(() => vi.fn());
const getFilterOptionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/bookings/lib/get-bookings", () => ({
  getBookings: getBookingsMock,
}));

vi.mock("@/features/bookings/lib/get-booking-form-options", () => ({
  getBookingFilterOptions: getFilterOptionsMock,
}));

// A client component that needs the app router; not what these tests are about.
vi.mock("@/features/bookings/components/bookings-filters", () => ({
  BookingsFilters: () => null,
}));

import BookingsPage from "@/app/(dashboard)/bookings/page";

const OPS = { id: "u1", role: "operations_manager" as const };
const PARTNER = { id: "u2", role: "partner_user" as const };

describe("BookingsPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    getBookingsMock.mockReset();
    getBookingsMock.mockResolvedValue({ bookings: [], total: 0, page: 1 });
    getFilterOptionsMock.mockReset();
    getFilterOptionsMock.mockResolvedValue({ airports: [] });
  });

  it("should guard the page with either booking permission (defense-in-depth alongside the layout)", async () => {
    requireAnyPermissionMock.mockResolvedValue(OPS);

    await BookingsPage({ searchParams: Promise.resolve({}) });

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "bookings:manage",
      "bookings:view_own_partner",
    ]);
  });

  it("should pass the status and date filters from the URL to getBookings", async () => {
    requireAnyPermissionMock.mockResolvedValue(OPS);

    await BookingsPage({
      searchParams: Promise.resolve({
        status: "confirmed",
        date_from: "2026-09-01",
      }),
    });

    expect(getBookingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "confirmed", date_from: "2026-09-01" }),
    );
  });

  it("should ignore an invalid status in the URL instead of failing the render", async () => {
    requireAnyPermissionMock.mockResolvedValue(PARTNER);

    await BookingsPage({ searchParams: Promise.resolve({ status: "bogus" }) });

    expect(getBookingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined }),
    );
  });

  it("should propagate the guard's redirect and not load bookings", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      BookingsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(getBookingsMock).not.toHaveBeenCalled();
  });

  describe("way back to the partner home (VI-F03-S02)", () => {
    async function html(user: { id: string; role: string }) {
      requireAnyPermissionMock.mockResolvedValue(user);
      return renderToStaticMarkup(
        await BookingsPage({ searchParams: Promise.resolve({}) }),
      );
    }

    it("should offer a link back to the partner home to a partner user", async () => {
      const markup = await html(PARTNER);

      expect(markup).toContain('href="/partner"');
      expect(markup).toContain("Back to Partner home");
    });

    it("should give a partner user an Add Booking button, since they may create bookings for their own partner", async () => {
      expect(await html(PARTNER)).toContain("Add Booking");
    });

    it.each([
      ["operations_manager"],
      ["admin"],
    ])("should not offer the link back to %s, who does not come from the partner home", async (role) => {
      const markup = await html({ id: "u3", role });

      expect(markup).not.toContain("Back to Partner home");
      expect(markup).toContain("Add Booking");
    });

    it("should show the empty state, not an error, to a partner with no bookings, and still offer the way back", async () => {
      const markup = await html(PARTNER);

      expect(markup).toContain("No bookings found");
      expect(markup).toContain("Back to Partner home");
    });
  });
});
