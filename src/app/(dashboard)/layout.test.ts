import { describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAuth: requireAuthMock,
}));

import DashboardLayout from "@/app/(dashboard)/layout";

const USER = {
  id: "user-1",
  email: "user@example.com",
  full_name: "Jane Doe",
  role: "partner_user" as const,
  partner_id: null,
  is_active: true,
};

describe("DashboardLayout", () => {
  it("should guard the area with requireAuth (any authenticated, active, valid profile)", async () => {
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(USER);

    await DashboardLayout({ children: null });

    expect(requireAuthMock).toHaveBeenCalledTimes(1);
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requireAuthMock.mockReset();
    requireAuthMock.mockRejectedValue(new Error("REDIRECT:/login"));

    await expect(DashboardLayout({ children: null })).rejects.toThrow(
      "REDIRECT:/login",
    );
  });
});
