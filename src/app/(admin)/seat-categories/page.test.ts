import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getSeatCategoriesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/seat-categories/lib/get-seat-categories", () => ({
  getSeatCategories: getSeatCategoriesMock,
}));

import SeatCategoriesPage from "@/app/(admin)/seat-categories/page";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

describe("SeatCategoriesPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getSeatCategoriesMock.mockReset();
    getSeatCategoriesMock.mockResolvedValue({ seatCategories: [], total: 0, page: 1 });
  });

  it("should guard the page with seat_categories:manage (defense-in-depth alongside the layout)", async () => {
    requirePermissionMock.mockResolvedValue(USER);

    await SeatCategoriesPage({ searchParams: Promise.resolve({}) });

    expect(requirePermissionMock).toHaveBeenCalledWith("seat_categories:manage");
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      SeatCategoriesPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(getSeatCategoriesMock).not.toHaveBeenCalled();
  });
});
