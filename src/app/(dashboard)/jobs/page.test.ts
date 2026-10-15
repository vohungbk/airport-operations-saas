import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getJobsMock = vi.hoisted(() => vi.fn());
const getTechnicianOptionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/jobs/lib/get-jobs", () => ({ getJobs: getJobsMock }));

vi.mock("@/features/jobs/lib/get-technician-options", () => ({
  getTechnicianOptions: getTechnicianOptionsMock,
}));

// Client component that needs the app router; irrelevant to these assertions.
vi.mock("@/features/jobs/components/jobs-filters", () => ({
  JobsFilters: () => null,
}));

import JobsPage from "@/app/(dashboard)/jobs/page";

const OPS = { id: "u-1", role: "operations_manager" as const };
const TECHNICIAN = { id: "u-2", role: "technician" as const };
const OTHER_TECHNICIAN_ID = "d0000000-0000-0000-0000-000000000001";

function render(params: Record<string, string> = {}) {
  return JobsPage({ searchParams: Promise.resolve(params) });
}

describe("JobsPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    getJobsMock.mockReset();
    getTechnicianOptionsMock.mockReset();
    getJobsMock.mockResolvedValue({ jobs: [], total: 0 });
    getTechnicianOptionsMock.mockResolvedValue([]);
  });

  it("should guard the page with the jobs access permissions", async () => {
    requireAnyPermissionMock.mockResolvedValue(OPS);

    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "technicians:manage",
      "jobs:view_assigned",
    ]);
  });

  it("should propagate the guard's redirect without loading data", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getJobsMock).not.toHaveBeenCalled();
  });

  it("should not apply an over-long search to the query", async () => {
    requireAnyPermissionMock.mockResolvedValue(OPS);

    await render({ q: "a".repeat(101) });

    expect(getJobsMock).toHaveBeenCalledWith(
      expect.objectContaining({ q: undefined }),
    );
  });

  it("should load technician options and keep the technician filter for managers", async () => {
    requireAnyPermissionMock.mockResolvedValue(OPS);

    await render({ technician_id: OTHER_TECHNICIAN_ID });

    expect(getTechnicianOptionsMock).toHaveBeenCalled();
    expect(getJobsMock).toHaveBeenCalledWith(
      expect.objectContaining({ technician_id: OTHER_TECHNICIAN_ID }),
    );
  });

  it("should ignore the technician filter and skip the options for a technician", async () => {
    requireAnyPermissionMock.mockResolvedValue(TECHNICIAN);

    await render({ technician_id: OTHER_TECHNICIAN_ID });

    expect(getTechnicianOptionsMock).not.toHaveBeenCalled();
    expect(getJobsMock).toHaveBeenCalledWith(
      expect.objectContaining({ technician_id: undefined }),
    );
  });

  it("should show the Create job link for managers", async () => {
    requireAnyPermissionMock.mockResolvedValue(OPS);

    const html = renderToStaticMarkup(await render());

    expect(html).toContain('href="/jobs/new"');
  });

  it("should hide the Create job link from a technician", async () => {
    requireAnyPermissionMock.mockResolvedValue(TECHNICIAN);

    const html = renderToStaticMarkup(await render());

    expect(html).not.toContain('href="/jobs/new"');
  });
});
