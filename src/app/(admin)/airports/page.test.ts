import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getAirportsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/airports/lib/get-airports", () => ({
  getAirports: getAirportsMock,
}));

import AirportsPage from "@/app/(admin)/airports/page";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

describe("AirportsPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getAirportsMock.mockReset();
    getAirportsMock.mockResolvedValue({ airports: [], total: 0 });
  });

  it("should guard the page with airports:manage (defense-in-depth alongside the layout)", async () => {
    requirePermissionMock.mockResolvedValue(USER);

    await AirportsPage({ searchParams: Promise.resolve({}) });

    expect(requirePermissionMock).toHaveBeenCalledWith("airports:manage");
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      AirportsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(getAirportsMock).not.toHaveBeenCalled();
  });
});
