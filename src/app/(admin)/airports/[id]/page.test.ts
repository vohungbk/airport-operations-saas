import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getAirportByIdMock = vi.hoisted(() => vi.fn());
const getAirportRelatedCountsMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/airports/lib/get-airport-by-id", () => ({
  getAirportById: getAirportByIdMock,
}));

vi.mock("@/features/airports/lib/get-airport-related-counts", () => ({
  getAirportRelatedCounts: getAirportRelatedCountsMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

import AirportDetailPage from "@/app/(admin)/airports/[id]/page";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

const AIRPORT = {
  id: "airport-1",
  code: "DXB",
  name: "Dubai International Airport",
  city: "Dubai",
  country: "United Arab Emirates",
  timezone: "Asia/Dubai",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("AirportDetailPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getAirportByIdMock.mockReset();
    getAirportRelatedCountsMock.mockReset();
    getAirportRelatedCountsMock.mockResolvedValue({
      seats: 0,
      bookings: 0,
      flights: 0,
    });
    notFoundMock.mockClear();
  });

  it("should guard the page with airports:manage (defense-in-depth alongside the layout)", async () => {
    requirePermissionMock.mockResolvedValue(USER);
    getAirportByIdMock.mockResolvedValue(AIRPORT);

    await AirportDetailPage({ params: Promise.resolve({ id: "airport-1" }) });

    expect(requirePermissionMock).toHaveBeenCalledWith("airports:manage");
    expect(getAirportByIdMock).toHaveBeenCalledWith("airport-1");
  });

  it("should call notFound() when the airport does not exist", async () => {
    requirePermissionMock.mockResolvedValue(USER);
    getAirportByIdMock.mockResolvedValue(null);

    await expect(
      AirportDetailPage({ params: Promise.resolve({ id: "missing-id" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
    expect(getAirportRelatedCountsMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      AirportDetailPage({ params: Promise.resolve({ id: "airport-1" }) }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(getAirportByIdMock).not.toHaveBeenCalled();
  });
});
