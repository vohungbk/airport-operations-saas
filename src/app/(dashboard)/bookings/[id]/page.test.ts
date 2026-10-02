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

vi.mock("@/features/bookings/lib/get-booking-events", () => ({
  getBookingEvents: getBookingEventsMock,
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import BookingDetailPage from "@/app/(dashboard)/bookings/[id]/page";

const ID = "f0000000-0000-4000-8000-000000000001";

describe("BookingDetailPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ role: "partner_user" });
    getBookingByIdMock.mockReset();
    getBookingEventsMock.mockReset();
    getBookingEventsMock.mockResolvedValue({ items: [], truncated: false });
  });

  it("should guard the page with either booking permission", async () => {
    getBookingByIdMock.mockResolvedValue({ id: ID });

    await BookingDetailPage({ params: Promise.resolve({ id: ID }) });

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "bookings:manage",
      "bookings:view_own_partner",
    ]);
  });

  it("should call notFound when the booking is missing or hidden by RLS", async () => {
    getBookingByIdMock.mockResolvedValue(null);

    await expect(
      BookingDetailPage({ params: Promise.resolve({ id: ID }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("should propagate the guard's redirect", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      BookingDetailPage({ params: Promise.resolve({ id: ID }) }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(getBookingByIdMock).not.toHaveBeenCalled();
  });
});
