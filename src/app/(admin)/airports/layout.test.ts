import { describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

import AirportsLayout from "@/app/(admin)/airports/layout";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

describe("AirportsLayout", () => {
  it("should guard the area with airports:manage", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(USER);

    await AirportsLayout({ children: null });

    expect(requirePermissionMock).toHaveBeenCalledWith("airports:manage");
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(AirportsLayout({ children: null })).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
  });
});
