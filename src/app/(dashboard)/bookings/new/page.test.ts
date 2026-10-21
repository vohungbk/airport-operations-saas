import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getBookingFormOptionsMock = vi.hoisted(() => vi.fn());
const getPartnerOptionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/bookings/lib/get-booking-form-options", () => ({
  getBookingFormOptions: getBookingFormOptionsMock,
  getPartnerBookingFormOptions: getPartnerOptionsMock,
}));

// The forms are client components that need the app router.
vi.mock("@/features/bookings/components/create-booking-form", () => ({
  CreateBookingForm: () => "MANAGER_FORM",
}));
vi.mock("@/features/bookings/components/create-partner-booking-form", () => ({
  CreatePartnerBookingForm: () => "PARTNER_FORM",
}));

import NewBookingPage from "@/app/(dashboard)/bookings/new/page";

const render = async () => renderToStaticMarkup(await NewBookingPage());

describe("NewBookingPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    getBookingFormOptionsMock.mockReset();
    getBookingFormOptionsMock.mockResolvedValue({
      partners: [],
      airports: [],
      categories: [],
      airport_timezones: {},
    });
    getPartnerOptionsMock.mockReset();
    getPartnerOptionsMock.mockResolvedValue({
      airports: [],
      categories: [],
      airport_timezones: {},
    });
  });

  it("should let managers and partner users in, and nobody else", async () => {
    requireAnyPermissionMock.mockResolvedValue({ role: "admin" });

    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "bookings:manage",
      "bookings:manage_own_partner",
    ]);
  });

  it.each(["admin", "operations_manager"] as const)(
    "should give %s the manager form, which picks the partner",
    async (role) => {
      requireAnyPermissionMock.mockResolvedValue({ role });

      expect(await render()).toContain("MANAGER_FORM");
      expect(getPartnerOptionsMock).not.toHaveBeenCalled();
    },
  );

  it("should give a partner user the partner form, with no partner list loaded", async () => {
    requireAnyPermissionMock.mockResolvedValue({ role: "partner_user" });

    const html = await render();

    expect(html).toContain("PARTNER_FORM");
    expect(html).not.toContain("MANAGER_FORM");
    expect(getBookingFormOptionsMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect and not load form options", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(NewBookingPage()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getBookingFormOptionsMock).not.toHaveBeenCalled();
    expect(getPartnerOptionsMock).not.toHaveBeenCalled();
  });
});
