import { describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

import AdminPage from "@/app/(admin)/admin/page";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

describe("AdminPage", () => {
  it("should guard the page with dashboards:view (defense-in-depth alongside the layout)", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(USER);

    await AdminPage();

    expect(requirePermissionMock).toHaveBeenCalledWith("dashboards:view");
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(AdminPage()).rejects.toThrow("REDIRECT:/forbidden");
  });
});
