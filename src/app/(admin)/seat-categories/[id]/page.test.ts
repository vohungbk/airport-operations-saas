import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getSeatCategoryByIdMock = vi.hoisted(() => vi.fn());
const getSeatCategoryRelatedCountsMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/seat-categories/lib/get-seat-category-by-id", () => ({
  getSeatCategoryById: getSeatCategoryByIdMock,
}));

vi.mock("@/features/seat-categories/lib/get-seat-category-related-counts", () => ({
  getSeatCategoryRelatedCounts: getSeatCategoryRelatedCountsMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

import SeatCategoryDetailPage from "@/app/(admin)/seat-categories/[id]/page";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

const SEAT_CATEGORY = {
  id: "seat-category-1",
  name: "Infant Carrier",
  description: null,
  min_child_age: 0,
  max_child_age: 12,
  safety_standard: "ECE R129",
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("SeatCategoryDetailPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getSeatCategoryByIdMock.mockReset();
    getSeatCategoryRelatedCountsMock.mockReset();
    getSeatCategoryRelatedCountsMock.mockResolvedValue({
      seats: 0,
    });
    notFoundMock.mockClear();
  });

  it("should guard the page with seat_categories:manage (defense-in-depth alongside the layout)", async () => {
    requirePermissionMock.mockResolvedValue(USER);
    getSeatCategoryByIdMock.mockResolvedValue(SEAT_CATEGORY);

    await SeatCategoryDetailPage({ params: Promise.resolve({ id: "seat-category-1" }) });

    expect(requirePermissionMock).toHaveBeenCalledWith("seat_categories:manage");
    expect(getSeatCategoryByIdMock).toHaveBeenCalledWith("seat-category-1");
  });

  it("should call notFound() when the seat category does not exist", async () => {
    requirePermissionMock.mockResolvedValue(USER);
    getSeatCategoryByIdMock.mockResolvedValue(null);

    await expect(
      SeatCategoryDetailPage({ params: Promise.resolve({ id: "missing-id" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      SeatCategoryDetailPage({ params: Promise.resolve({ id: "seat-category-1" }) }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(getSeatCategoryByIdMock).not.toHaveBeenCalled();
  });
});
