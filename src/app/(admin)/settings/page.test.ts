import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import SettingsPage from "@/app/(admin)/settings/page";

describe("SettingsPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
  });

  it("should guard with dashboards:view and redirect to the Provider settings", async () => {
    requirePermissionMock.mockResolvedValue({ role: "admin" });

    await expect(SettingsPage()).rejects.toThrow("REDIRECT:/settings/flight-provider");
    expect(requirePermissionMock).toHaveBeenCalledWith("dashboards:view");
  });

  it("should propagate the guard's forbidden instead of redirecting", async () => {
    requirePermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(SettingsPage()).rejects.toThrow("FORBIDDEN");
  });
});
