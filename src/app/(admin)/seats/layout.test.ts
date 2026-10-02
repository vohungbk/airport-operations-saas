import { describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

import SeatsLayout from "@/app/(admin)/seats/layout";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

describe("SeatsLayout", () => {
  it("should guard the area with seats:manage", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(USER);

    await SeatsLayout({ children: null });

    expect(requirePermissionMock).toHaveBeenCalledWith("seats:manage");
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(SeatsLayout({ children: null })).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
  });
});
