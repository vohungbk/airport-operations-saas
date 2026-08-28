import { describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAuth: requireAuthMock,
}));

import DashboardPage from "@/app/(dashboard)/dashboard/page";

const USER = {
  id: "user-1",
  email: "user@example.com",
  full_name: "Jane Doe",
  role: "partner_user" as const,
  partner_id: null,
  is_active: true,
};

describe("DashboardPage", () => {
  it("should guard the page with requireAuth (defense-in-depth alongside the layout)", async () => {
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue(USER);

    await DashboardPage();

    expect(requireAuthMock).toHaveBeenCalledTimes(1);
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requireAuthMock.mockReset();
    requireAuthMock.mockRejectedValue(new Error("REDIRECT:/login"));

    await expect(DashboardPage()).rejects.toThrow("REDIRECT:/login");
  });
});
