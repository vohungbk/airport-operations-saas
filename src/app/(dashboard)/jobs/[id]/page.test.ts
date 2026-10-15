import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getJobByIdMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/jobs/lib/get-job-by-id", () => ({
  getJobById: getJobByIdMock,
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import JobDetailPage from "@/app/(dashboard)/jobs/[id]/page";

describe("JobDetailPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    getJobByIdMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "user-1" });
  });

  it("should guard the page with the jobs access permissions", async () => {
    getJobByIdMock.mockResolvedValue({ id: "j-1", status: "assigned" });

    await JobDetailPage({ params: Promise.resolve({ id: "j-1" }) });

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "technicians:manage",
      "jobs:view_assigned",
    ]);
  });

  it("should propagate the guard's redirect without loading the job", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      JobDetailPage({ params: Promise.resolve({ id: "j-1" }) }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(getJobByIdMock).not.toHaveBeenCalled();
  });

  it("should call notFound when the job is missing or outside the user's scope", async () => {
    getJobByIdMock.mockResolvedValue(null);

    await expect(
      JobDetailPage({ params: Promise.resolve({ id: "other" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
