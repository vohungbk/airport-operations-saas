import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getSeatByIdMock = vi.hoisted(() => vi.fn());
const getSeatStatusHistoryMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/seats/lib/get-seat-by-id", () => ({
  getSeatById: getSeatByIdMock,
}));

vi.mock("@/features/seats/lib/get-seat-status-history", () => ({
  getSeatStatusHistory: getSeatStatusHistoryMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

import SeatDetailPage from "@/app/(admin)/seats/[id]/page";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

const SEAT = { id: "seat-1", serial_number: "SEAT-0001", status: "available" };

describe("SeatDetailPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getSeatByIdMock.mockReset();
    getSeatStatusHistoryMock.mockReset();
    getSeatStatusHistoryMock.mockResolvedValue({ items: [], truncated: false });
    notFoundMock.mockClear();
  });

  it("should guard the page with seats:manage (defense-in-depth alongside the layout)", async () => {
    requirePermissionMock.mockResolvedValue(USER);
    getSeatByIdMock.mockResolvedValue(SEAT);

    await SeatDetailPage({ params: Promise.resolve({ id: "seat-1" }) });

    expect(requirePermissionMock).toHaveBeenCalledWith("seats:manage");
    expect(getSeatByIdMock).toHaveBeenCalledWith("seat-1");
    expect(getSeatStatusHistoryMock).toHaveBeenCalledWith("seat-1");
  });

  it("should call notFound() when the seat does not exist or is hidden", async () => {
    requirePermissionMock.mockResolvedValue(USER);
    getSeatByIdMock.mockResolvedValue(null);

    await expect(
      SeatDetailPage({ params: Promise.resolve({ id: "missing-id" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("should propagate the guard's redirect and not query the seat", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      SeatDetailPage({ params: Promise.resolve({ id: "seat-1" }) }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(getSeatByIdMock).not.toHaveBeenCalled();
    expect(getSeatStatusHistoryMock).not.toHaveBeenCalled();
  });
});
