import { describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

import NewPartnerPage from "@/app/(admin)/partners/new/page";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

describe("NewPartnerPage", () => {
  it("should guard the page with partners:manage (defense-in-depth alongside the layout)", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(USER);

    await NewPartnerPage();

    expect(requirePermissionMock).toHaveBeenCalledWith("partners:manage");
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(NewPartnerPage()).rejects.toThrow("REDIRECT:/forbidden");
  });
});
