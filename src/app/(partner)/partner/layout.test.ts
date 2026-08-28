import { describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

import PartnerLayout from "@/app/(partner)/partner/layout";

const USER = {
  id: "user-1",
  email: "partner@example.com",
  full_name: "Partner User",
  role: "partner_user" as const,
  partner_id: null,
  is_active: true,
};

describe("PartnerLayout", () => {
  it("should guard the area with bookings:view_own_partner", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(USER);

    await PartnerLayout({ children: null });

    expect(requirePermissionMock).toHaveBeenCalledWith(
      "bookings:view_own_partner",
    );
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(PartnerLayout({ children: null })).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
  });
});
