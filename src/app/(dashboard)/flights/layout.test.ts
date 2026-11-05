import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

import FlightsLayout from "@/app/(dashboard)/flights/layout";
import { hasPermission } from "@/lib/auth/permissions";

describe("FlightsLayout", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
  });

  it("should guard the area with dashboards:view", async () => {
    requirePermissionMock.mockResolvedValue({ role: "operations_manager" });

    await FlightsLayout({ children: null });

    expect(requirePermissionMock).toHaveBeenCalledWith("dashboards:view");
  });

  it("should show a permission denied state by propagating the 403", async () => {
    requirePermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(FlightsLayout({ children: null })).rejects.toThrow("FORBIDDEN");
  });

  it("should let admin and operations manager in and keep a technician and a partner user out", () => {
    expect(hasPermission("admin", "dashboards:view")).toBe(true);
    expect(hasPermission("operations_manager", "dashboards:view")).toBe(true);
    expect(hasPermission("technician", "dashboards:view")).toBe(false);
    expect(hasPermission("partner_user", "dashboards:view")).toBe(false);
  });
});
