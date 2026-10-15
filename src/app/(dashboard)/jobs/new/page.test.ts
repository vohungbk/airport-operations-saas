import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getJobFormOptionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/jobs/lib/get-job-form-options", () => ({
  getJobFormOptions: getJobFormOptionsMock,
}));

import NewJobPage from "@/app/(dashboard)/jobs/new/page";

describe("NewJobPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getJobFormOptionsMock.mockReset();
    getJobFormOptionsMock.mockResolvedValue({ technicians: [], bookings: [] });
  });

  it("should require technicians:manage so technicians cannot create jobs", async () => {
    requirePermissionMock.mockResolvedValue({ role: "operations_manager" });

    await NewJobPage();

    expect(requirePermissionMock).toHaveBeenCalledWith("technicians:manage");
  });

  it("should propagate the guard's redirect and not load form options", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(NewJobPage()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getJobFormOptionsMock).not.toHaveBeenCalled();
  });
});
