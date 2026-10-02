import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getBookingFormOptionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/bookings/lib/get-booking-form-options", () => ({
  getBookingFormOptions: getBookingFormOptionsMock,
}));

import NewBookingPage from "@/app/(dashboard)/bookings/new/page";

describe("NewBookingPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getBookingFormOptionsMock.mockReset();
    getBookingFormOptionsMock.mockResolvedValue({
      partners: [],
      airports: [],
      categories: [],
      airport_timezones: {},
    });
  });

  it("should require bookings:manage so partner users cannot create bookings", async () => {
    requirePermissionMock.mockResolvedValue({ role: "admin" });

    await NewBookingPage();

    expect(requirePermissionMock).toHaveBeenCalledWith("bookings:manage");
  });

  it("should propagate the guard's redirect and not load form options", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(NewBookingPage()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getBookingFormOptionsMock).not.toHaveBeenCalled();
  });
});
