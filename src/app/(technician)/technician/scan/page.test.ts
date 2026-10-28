import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getTodaysJobsMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
);

vi.mock("@/lib/auth/current-user", () => ({ requirePermission: requirePermissionMock }));
vi.mock("@/features/jobs/lib/get-todays-jobs", () => ({ getTodaysJobs: getTodaysJobsMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import TechnicianScanPage from "@/app/(technician)/technician/scan/page";

const job = (id: string, job_type: string) => ({ id, job_type });

describe("TechnicianScanPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ id: "t-1", role: "technician" });
    getTodaysJobsMock.mockReset();
    redirectMock.mockClear();
  });

  it("should guard the page with jobs:view_assigned", async () => {
    getTodaysJobsMock.mockResolvedValue({ jobs: [], next_pickup_at: null });

    await TechnicianScanPage();

    expect(requirePermissionMock).toHaveBeenCalledWith("jobs:view_assigned");
  });

  it("should propagate the guard's refusal and read no job", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(TechnicianScanPage()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getTodaysJobsMock).not.toHaveBeenCalled();
  });

  it("should send the technician to the scan of the first installation job of the day", async () => {
    getTodaysJobsMock.mockResolvedValue({
      jobs: [job("clean", "cleaning"), job("install", "installation"), job("other", "installation")],
      next_pickup_at: null,
    });

    await expect(TechnicianScanPage()).rejects.toThrow("REDIRECT:/jobs/install/scan");
  });

  it("should say there is no job to scan when the day has no installation job", async () => {
    getTodaysJobsMock.mockResolvedValue({ jobs: [job("clean", "cleaning")], next_pickup_at: null });

    const out = renderToStaticMarkup(await TechnicianScanPage());

    expect(out).toContain("No job to scan.");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("should throw when the jobs could not be read, so the error state shows", async () => {
    getTodaysJobsMock.mockRejectedValue(new Error("db down"));

    await expect(TechnicianScanPage()).rejects.toThrow("db down");
  });
});
