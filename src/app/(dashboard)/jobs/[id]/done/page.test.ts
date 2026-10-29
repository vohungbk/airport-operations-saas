import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getStepDoneMock = vi.hoisted(() => vi.fn());
const getTodaysJobsMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);
const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
);

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/jobs/lib/get-step-done", () => ({ getStepDone: getStepDoneMock }));
vi.mock("@/features/jobs/lib/get-todays-jobs", () => ({ getTodaysJobs: getTodaysJobsMock }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock, redirect: redirectMock }));

import StepDonePage from "@/app/(dashboard)/jobs/[id]/done/page";
import { JOBS_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";

const done = {
  step: "installation",
  job_id: "j-1",
  booking_number: "BK-1",
  airport: { code: "DXB", timezone: "Asia/Dubai" },
  seat: { serial_number: "SEAT-0001", category_name: null },
  completed_by: "Omar Haddad",
  completed_at: "2026-10-24T10:20:00Z",
};

const render = async (query: Record<string, string | string[] | undefined> = { step: "installation" }) =>
  renderToStaticMarkup(
    await StepDonePage({ params: Promise.resolve({ id: "j-1" }), searchParams: Promise.resolve(query) }),
  );

describe("StepDonePage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "t-1", role: "technician" });
    getStepDoneMock.mockReset();
    getStepDoneMock.mockResolvedValue(done);
    getTodaysJobsMock.mockReset();
    getTodaysJobsMock.mockResolvedValue({ jobs: [{ id: "j-1" }, { id: "j-2" }], next_pickup_at: null });
    notFoundMock.mockClear();
    redirectMock.mockClear();
  });

  it("should guard the page with the job permissions", async () => {
    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith(JOBS_ACCESS_PERMISSIONS);
  });

  it("should propagate the guard's refusal", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
  });

  it("should show the success screen of a step that is done, with the next job of the day", async () => {
    const out = await render();

    expect(getStepDoneMock).toHaveBeenCalledWith("j-1", "installation");
    expect(out).toContain("Installation completed");
    expect(out).toContain('href="/jobs/j-2"');
  });

  it("should not find a step the address made up", async () => {
    for (const step of ["scan", undefined, ["installation"]]) {
      await expect(render({ step })).rejects.toThrow("NOT_FOUND");
    }
    expect(getStepDoneMock).not.toHaveBeenCalled();
  });

  it("should send the user to the job screen when the step is not done or the job is not theirs", async () => {
    getStepDoneMock.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("REDIRECT:/jobs/j-1");
  });

  it("should offer the way back when the current job is the only one", async () => {
    getTodaysJobsMock.mockResolvedValue({ jobs: [{ id: "j-1" }], next_pickup_at: null });

    const out = await render();

    expect(out).toContain("Back to Today&#x27;s Jobs");
    expect(out).not.toContain("Next job");
  });

  it("should keep the success screen, with the way back, when the jobs could not be read", async () => {
    getTodaysJobsMock.mockRejectedValue(new Error("db down"));

    const out = await render();

    expect(out).toContain("Installation completed");
    expect(out).toContain("Back to Today&#x27;s Jobs");
  });

  it("should not look for a next job for a manager, and go back to the jobs", async () => {
    requireAnyPermissionMock.mockResolvedValue({ id: "m-1", role: "operations_manager" });

    const out = await render();

    expect(getTodaysJobsMock).not.toHaveBeenCalled();
    expect(out).toContain("Back to jobs");
    expect(out).toContain('href="/jobs"');
  });
});
