import { describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

import IncidentsLayout from "@/app/(dashboard)/incidents/layout";

describe("IncidentsLayout", () => {
  it("should guard the area with incidents:report or incidents:view", async () => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "user-1" });

    await IncidentsLayout({ children: null });

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "incidents:report",
      "incidents:view",
    ]);
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(IncidentsLayout({ children: null })).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
  });
});
