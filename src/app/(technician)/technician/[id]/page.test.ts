import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getJobInformationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requirePermission: requirePermissionMock }));
vi.mock("@/features/jobs/lib/get-job-information", () => ({ getJobInformation: getJobInformationMock }));

import JobInformationPage from "@/app/(technician)/technician/[id]/page";

const params = Promise.resolve({ id: "job-1" });

const JOB = {
  id: "job-1",
  job_number: "JOB-2026-0081",
  deadline_at: "2026-10-24T11:15:00Z",
  status: "assigned",
  job_type: "installation",
  pickup_at: "2026-10-24T11:00:00Z",
  booking_number: "BK-2026-000123",
  partner_name: "Emirates Rent A Car",
  technician: "Omar Haddad",
  vehicle: "Toyota RAV4",
  vehicle_bay: "C-14",
  airport: { code: "DXB", city: "Dubai", timezone: "Asia/Dubai" },
  required_category: "Convertible",
  seat: "SEAT-0001",
  flight: null,
};

describe("JobInformationPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getJobInformationMock.mockReset();
    requirePermissionMock.mockResolvedValue({ role: "technician" });
  });

  it("should guard the page with jobs:view_assigned", async () => {
    getJobInformationMock.mockResolvedValue(JOB);

    await JobInformationPage({ params });

    expect(requirePermissionMock).toHaveBeenCalledWith("jobs:view_assigned");
  });

  it("should show the job information for the assigned technician", async () => {
    getJobInformationMock.mockResolvedValue(JOB);

    const out = renderToStaticMarkup(await JobInformationPage({ params }));

    expect(getJobInformationMock).toHaveBeenCalledWith("job-1");
    expect(out).toContain("Job information");
    expect(out).toContain("JOB-2026-0081 · BK-2026-000123 · Asia/Dubai");
    expect(out).toContain("Emirates Rent A Car");
    expect(out).toContain("SEAT-0001");
  });

  it("should show the forbidden state when the job is not assigned to the technician", async () => {
    getJobInformationMock.mockResolvedValue(null);

    const out = renderToStaticMarkup(await JobInformationPage({ params }));

    expect(out).toContain("You cannot open this job");
    expect(out).not.toContain("Job information");
  });

  it("should propagate the guard's redirect instead of reading the job", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(JobInformationPage({ params })).rejects.toThrow("REDIRECT:/forbidden");
    expect(getJobInformationMock).not.toHaveBeenCalled();
  });
});
