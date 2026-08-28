import { describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

import TechnicianLayout from "@/app/(technician)/technician/layout";

const USER = {
  id: "user-1",
  email: "tech@example.com",
  full_name: "Tech User",
  role: "technician" as const,
  partner_id: null,
  is_active: true,
};

describe("TechnicianLayout", () => {
  it("should guard the area with jobs:view_assigned", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(USER);

    await TechnicianLayout({ children: null });

    expect(requirePermissionMock).toHaveBeenCalledWith("jobs:view_assigned");
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(TechnicianLayout({ children: null })).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
  });
});
