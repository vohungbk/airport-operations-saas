import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getJobForEditMock = vi.hoisted(() => vi.fn());
const getJobFormOptionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/jobs/lib/get-job-for-edit", () => ({
  getJobForEdit: getJobForEditMock,
}));

vi.mock("@/features/jobs/lib/get-job-form-options", () => ({
  getJobFormOptions: getJobFormOptionsMock,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/jobs",
}));

import EditJobPage from "@/app/(dashboard)/jobs/[id]/edit/page";

const params = Promise.resolve({ id: "a0000000-0000-0000-0000-000000000009" });

describe("EditJobPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getJobForEditMock.mockReset();
    getJobFormOptionsMock.mockReset();
    requirePermissionMock.mockResolvedValue({ role: "operations_manager" });
    getJobFormOptionsMock.mockResolvedValue({ technicians: [], bookings: [] });
  });

  it("should require technicians:manage so technicians cannot edit jobs", async () => {
    getJobForEditMock.mockResolvedValue({
      id: "a0000000-0000-0000-0000-000000000009",
      job_number: "JB-0142",
      status: "in_progress",
      job_type: "inspection",
      technician_id: "t-1",
      updated_at: "2026-11-11T06:42:00Z",
      booking: { id: "b-1", booking_number: "BK-2048", airport: null },
    });

    await EditJobPage({ params });

    expect(requirePermissionMock).toHaveBeenCalledWith("technicians:manage");
  });

  it("should propagate the guard's redirect and not load the job", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(EditJobPage({ params })).rejects.toThrow("REDIRECT:/forbidden");
    expect(getJobForEditMock).not.toHaveBeenCalled();
  });

  it("should show not found when the job does not exist or is hidden", async () => {
    getJobForEditMock.mockResolvedValue(null);

    await expect(EditJobPage({ params })).rejects.toThrow("NOT_FOUND");
  });
});
