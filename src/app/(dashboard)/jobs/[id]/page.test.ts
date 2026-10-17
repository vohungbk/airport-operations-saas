import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getJobByIdMock = vi.hoisted(() => vi.fn());
const getJobEventsMock = vi.hoisted(() => vi.fn());
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

vi.mock("@/features/jobs/lib/get-job-events", () => ({
  getJobEvents: getJobEventsMock,
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import JobDetailPage from "@/app/(dashboard)/jobs/[id]/page";

describe("JobDetailPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    getJobByIdMock.mockReset();
    getJobEventsMock.mockReset();
    getJobEventsMock.mockResolvedValue({ events: [], truncated: false });
    requireAnyPermissionMock.mockResolvedValue({
      id: "user-1",
      role: "technician",
    });
  });

  it("should guard the page with the jobs access permissions", async () => {
    getJobByIdMock.mockResolvedValue({ id: "j-1", status: "assigned", job_type: "installation" });

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

  it("should offer a technician only the work transitions", async () => {
    getJobByIdMock.mockResolvedValue({ id: "j-1", status: "assigned", job_type: "installation" });

    const element = await JobDetailPage({
      params: Promise.resolve({ id: "j-1" }),
    });

    expect(element.props.allowedStatuses).toEqual(["in_progress"]);
  });

  it("should also offer cancel to an operations manager", async () => {
    requireAnyPermissionMock.mockResolvedValue({
      id: "user-2",
      role: "operations_manager",
    });
    getJobByIdMock.mockResolvedValue({ id: "j-1", status: "in_progress", job_type: "installation" });

    const element = await JobDetailPage({
      params: Promise.resolve({ id: "j-1" }),
    });

    expect(element.props.allowedStatuses).toEqual(["completed", "cancelled"]);
  });

  it("should offer nothing for a completed job", async () => {
    getJobByIdMock.mockResolvedValue({ id: "j-1", status: "completed", job_type: "installation" });

    const element = await JobDetailPage({
      params: Promise.resolve({ id: "j-1" }),
    });

    expect(element.props.allowedStatuses).toEqual([]);
  });

  it("should offer Record work to the assigned technician of an installation job", async () => {
    getJobByIdMock.mockResolvedValue({
      id: "j-1",
      status: "in_progress",
      job_type: "installation",
      technician: { id: "user-1" },
    });

    const element = await JobDetailPage({
      params: Promise.resolve({ id: "j-1" }),
    });

    expect(element.props.workRecordHref).toBe("/jobs/j-1/installation");
  });

  it("should offer Record work for the assigned technician on a cleaning job", async () => {
    getJobByIdMock.mockResolvedValue({
      id: "j-1",
      status: "in_progress",
      job_type: "cleaning",
      technician: { id: "user-1" },
    });

    const element = await JobDetailPage({
      params: Promise.resolve({ id: "j-1" }),
    });

    expect(element.props.workRecordHref).toBe("/jobs/j-1/cleaning");
  });

  it("should not offer Record work while the inspection screen is not available", async () => {
    getJobByIdMock.mockResolvedValue({
      id: "j-1",
      status: "in_progress",
      job_type: "inspection",
      technician: { id: "user-1" },
    });

    const element = await JobDetailPage({
      params: Promise.resolve({ id: "j-1" }),
    });

    expect(element.props.workRecordHref).toBeNull();
  });
});
