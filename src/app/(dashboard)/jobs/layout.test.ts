import { describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

import JobsLayout from "@/app/(dashboard)/jobs/layout";

describe("JobsLayout", () => {
  it("should guard the area with technicians:manage or jobs:view_assigned", async () => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "user-1" });

    await JobsLayout({ children: null });

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "technicians:manage",
      "jobs:view_assigned",
    ]);
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(JobsLayout({ children: null })).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
  });
});
