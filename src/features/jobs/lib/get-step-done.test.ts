import { beforeEach, describe, expect, it, vi } from "vitest";

const installationMock = vi.hoisted(() => vi.fn());
const cleaningMock = vi.hoisted(() => vi.fn());
const inspectionMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/installations/lib/get-installation-context", () => ({ getInstallationContext: installationMock }));
vi.mock("@/features/cleaning/lib/get-cleaning-context", () => ({ getCleaningContext: cleaningMock }));
vi.mock("@/features/inspections/lib/get-inspection-context", () => ({ getInspectionContext: inspectionMock }));

import { getStepDone } from "@/features/jobs/lib/get-step-done";

const base = {
  job: { id: "j-1" },
  booking: {
    booking_number: "BK-1",
    airport: { code: "DXB", name: "Dubai", timezone: "Asia/Dubai" },
    seat: { id: "s-1", serial_number: "SEAT-0001", status: "available", category_name: "Convertible" },
  },
};

describe("getStepDone", () => {
  beforeEach(() => {
    for (const mock of [installationMock, cleaningMock, inspectionMock]) mock.mockReset();
  });

  it("should give the installation of a job that has a record, with who recorded it and when", async () => {
    installationMock.mockResolvedValue({
      ...base,
      installation: { completed_at: "2026-10-24T10:18:00Z", created_at: "2026-10-24T10:19:00Z", recorded_by: "Omar Haddad" },
    });

    await expect(getStepDone("j-1", "installation")).resolves.toEqual({
      step: "installation",
      job_id: "j-1",
      booking_number: "BK-1",
      airport: { code: "DXB", timezone: "Asia/Dubai" },
      seat: { serial_number: "SEAT-0001", category_name: "Convertible" },
      completed_by: "Omar Haddad",
      completed_at: "2026-10-24T10:18:00Z",
    });
  });

  it("should give null for a step that has no record yet", async () => {
    installationMock.mockResolvedValue({ ...base, installation: null });
    cleaningMock.mockResolvedValue({ ...base, cleaning: null });
    inspectionMock.mockResolvedValue({ ...base, inspection: null });

    await expect(getStepDone("j-1", "installation")).resolves.toBeNull();
    await expect(getStepDone("j-1", "cleaning")).resolves.toBeNull();
    await expect(getStepDone("j-1", "inspection")).resolves.toBeNull();
  });

  it("should give null for a cleaning that was started and not completed", async () => {
    cleaningMock.mockResolvedValue({
      ...base,
      cleaning: { completed_at: null, started_at: "2026-10-24T09:00:00Z", recorded_by: "Omar Haddad" },
    });

    await expect(getStepDone("j-1", "cleaning")).resolves.toBeNull();
  });

  it("should give the completed cleaning and the inspection with the time they were recorded", async () => {
    cleaningMock.mockResolvedValue({
      ...base,
      cleaning: { completed_at: "2026-10-24T09:20:00Z", recorded_by: "Omar Haddad" },
    });
    inspectionMock.mockResolvedValue({
      ...base,
      inspection: { created_at: "2026-10-24T09:45:00Z", recorded_by: null },
    });

    await expect(getStepDone("j-1", "cleaning")).resolves.toMatchObject({ completed_at: "2026-10-24T09:20:00Z" });
    await expect(getStepDone("j-1", "inspection")).resolves.toMatchObject({
      completed_at: "2026-10-24T09:45:00Z",
      completed_by: null,
    });
  });

  it("should give null for a job that is unknown or hidden by RLS", async () => {
    installationMock.mockResolvedValue(null);

    await expect(getStepDone("j-2", "installation")).resolves.toBeNull();
  });
});
