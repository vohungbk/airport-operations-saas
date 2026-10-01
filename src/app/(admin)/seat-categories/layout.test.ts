import { describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

import SeatCategoriesLayout from "@/app/(admin)/seat-categories/layout";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

describe("SeatCategoriesLayout", () => {
  it("should guard the area with seat_categories:manage", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(USER);

    await SeatCategoriesLayout({ children: null });

    expect(requirePermissionMock).toHaveBeenCalledWith("seat_categories:manage");
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(SeatCategoriesLayout({ children: null })).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
  });
});
