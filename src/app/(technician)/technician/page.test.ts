import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

const getTodaysJobsMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/jobs/lib/get-todays-jobs", () => ({
  getTodaysJobs: getTodaysJobsMock,
}));

import TechnicianPage from "@/app/(technician)/technician/page";

const USER = {
  id: "user-1",
  email: "tech@example.com",
  full_name: "Tech User",
  role: "technician" as const,
  partner_id: null,
  is_active: true,
};

describe("TechnicianPage", () => {
  it("should guard the page with jobs:view_assigned (defense-in-depth alongside the layout)", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(USER);
    getTodaysJobsMock.mockResolvedValue({ jobs: [], next_pickup_at: null });

    await TechnicianPage();

    expect(requirePermissionMock).toHaveBeenCalledWith("jobs:view_assigned");
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(TechnicianPage()).rejects.toThrow("REDIRECT:/forbidden");
  });

  it("should show the empty state when there are no jobs today", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(USER);
    getTodaysJobsMock.mockResolvedValue({ jobs: [], next_pickup_at: null });

    const out = renderToStaticMarkup(await TechnicianPage());

    expect(out).toContain("Today&#x27;s Jobs");
    expect(out).toContain("Tech User · ");
    expect(out).toContain("0 assigned jobs");
    expect(out).toContain("No jobs today.");
  });

  it("should throw when the jobs could not be read, so the error state shows and not an empty list", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(USER);
    getTodaysJobsMock.mockRejectedValue(new Error("db down"));

    await expect(TechnicianPage()).rejects.toThrow("db down");
  });
});
