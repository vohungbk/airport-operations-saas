import { describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

import BookingsLayout from "@/app/(dashboard)/bookings/layout";

describe("BookingsLayout", () => {
  it("should guard the area with bookings:manage or bookings:view_own_partner", async () => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({});

    await BookingsLayout({ children: null });

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "bookings:manage",
      "bookings:view_own_partner",
    ]);
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(BookingsLayout({ children: null })).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
  });
});
