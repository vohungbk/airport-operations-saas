import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
);

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import BookingRevenuePage from "@/app/(dashboard)/bookings/[id]/revenue/page";
import { FINANCE_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";

const BOOKING_ID = "f0000000-0000-0000-0000-000000000025";

describe("BookingRevenuePage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    redirectMock.mockClear();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "operations_manager" });
  });

  it("should send an old revenue link to the Revenue tab of the booking", async () => {
    await expect(BookingRevenuePage({ params: Promise.resolve({ id: BOOKING_ID }) })).rejects.toThrow(
      `REDIRECT:/bookings/${BOOKING_ID}?tab=revenue`,
    );
    expect(requireAnyPermissionMock).toHaveBeenCalledWith(FINANCE_ACCESS_PERMISSIONS);
  });

  it("should not redirect a role without the finance permission (a technician gets the forbidden page) (AC09)", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(BookingRevenuePage({ params: Promise.resolve({ id: BOOKING_ID }) })).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
