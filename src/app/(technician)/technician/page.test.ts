import { describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

import TechnicianPage from "@/app/(technician)/technician/page";

const USER = {
  id: "user-1",
  email: "tech@example.com",
  full_name: "Tech User",
  role: "technician" as const,
  partner_id: null,
  is_active: true,
};

describe("TechnicianPage", () => {
  it("should guard the page with jobs:view_assigned (defense-in-depth alongside the layout)", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(USER);

    await TechnicianPage();

    expect(requirePermissionMock).toHaveBeenCalledWith("jobs:view_assigned");
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(TechnicianPage()).rejects.toThrow("REDIRECT:/forbidden");
  });
});
