import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getBookingByIdMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);
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

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

// The forms are client components that need the app router.
vi.mock("@/features/bookings/components/edit-booking-form", () => ({
  EditBookingForm: () => "MANAGER_FORM",
}));
vi.mock("@/features/bookings/components/edit-partner-booking-form", () => ({
  EditPartnerBookingForm: () => "PARTNER_FORM",
}));

import EditBookingPage from "@/app/(dashboard)/bookings/[id]/edit/page";

const ID = "f0000000-0000-4000-8000-000000000001";
const AIRPORT = { timezone: "Asia/Dubai" };
const params = Promise.resolve({ id: ID });
const render = async () =>
  renderToStaticMarkup(await EditBookingPage({ params }));

describe("EditBookingPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ role: "operations_manager" });
    getBookingByIdMock.mockReset();
  });

  it("should let managers and partner users in, and nobody else", async () => {
    getBookingByIdMock.mockResolvedValue({ id: ID, status: "pending", airport: AIRPORT });

    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "bookings:manage",
      "bookings:manage_own_partner",
    ]);
  });

  it("should redirect a terminal booking back to its detail page", async () => {
    getBookingByIdMock.mockResolvedValue({ id: ID, status: "cancelled", airport: AIRPORT });

    await expect(EditBookingPage({ params })).rejects.toThrow(`REDIRECT:/bookings/${ID}`);
  });

  it("should call notFound when the booking airport is hidden or missing", async () => {
    getBookingByIdMock.mockResolvedValue({ id: ID, status: "pending", airport: null });

    await expect(EditBookingPage({ params })).rejects.toThrow("NOT_FOUND");
  });

  it("should call notFound for an unknown booking, or one of another partner that RLS hides", async () => {
    getBookingByIdMock.mockResolvedValue(null);

    await expect(EditBookingPage({ params })).rejects.toThrow("NOT_FOUND");
  });

  it("should let a manager edit a confirmed booking", async () => {
    getBookingByIdMock.mockResolvedValue({ id: ID, status: "confirmed", airport: AIRPORT });

    expect(await render()).toContain("MANAGER_FORM");
  });

  it("should give a partner user the partner form for a pending booking", async () => {
    requireAnyPermissionMock.mockResolvedValue({ role: "partner_user" });
    getBookingByIdMock.mockResolvedValue({
      id: ID,
      status: "pending",
      booking_number: "BK-00001",
      airport: AIRPORT,
    });

    const html = await render();

    expect(html).toContain("PARTNER_FORM");
    expect(html).not.toContain("MANAGER_FORM");
  });

  it.each(["confirmed", "assigned", "in_progress", "completed", "cancelled", "no_show"])(
    "should send a partner user back to the detail page when the booking is %s",
    async (status) => {
      requireAnyPermissionMock.mockResolvedValue({ role: "partner_user" });
      getBookingByIdMock.mockResolvedValue({ id: ID, status, airport: AIRPORT });

      await expect(EditBookingPage({ params })).rejects.toThrow(`REDIRECT:/bookings/${ID}`);
    },
  );
});
