import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getContextMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/installations/lib/get-installation-context", () => ({ getInstallationContext: getContextMock }));
vi.mock("@/features/installations/actions/verify-seat-scan.action", () => ({ verifySeatScanAction: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import ScanPage from "@/app/(dashboard)/jobs/[id]/scan/page";
import { INSTALLATION_RECORD_PERMISSIONS } from "@/lib/auth/permissions";

const context = (overrides: Record<string, unknown> = {}, seat: unknown = { id: "s-1", serial_number: "SEAT-0001" }) => ({
  job: { id: "j-1", status: "assigned", job_type: "installation", technician_id: "t-1", ...overrides },
  booking: { booking_number: "BK-1", airport: { code: "DXB", name: "Dubai", timezone: "Asia/Dubai" }, seat },
  installation: null,
});

const render = async () => renderToStaticMarkup(await ScanPage({ params: Promise.resolve({ id: "j-1" }) }));

describe("ScanPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "t-1", role: "technician" });
    getContextMock.mockReset();
    getContextMock.mockResolvedValue(context());
    notFoundMock.mockClear();
  });

  it("should guard the page with the installation permissions", async () => {
    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith(INSTALLATION_RECORD_PERMISSIONS);
  });

  it("should propagate the guard's refusal", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
  });

  it("should show the scanner for the seat of the job", async () => {
    const out = await render();

    expect(out).toContain("Scan seat QR");
    expect(out).toContain("Expected seat SEAT-0001");
  });

  it("should show the forbidden state, not the scanner, for a job that is not the technician's", async () => {
    getContextMock.mockResolvedValue(null);

    const out = await render();

    expect(out).toContain("You cannot scan for this job");
    expect(out).not.toContain("Scan seat QR");
  });

  it("should not find a job that is not an installation", async () => {
    getContextMock.mockResolvedValue(context({ job_type: "cleaning" }));

    await expect(render()).rejects.toThrow("NOT_FOUND");
  });

  it("should say so when the booking has no seat, or the job is done", async () => {
    getContextMock.mockResolvedValue(context({}, null));
    expect(await render()).toContain("no seat assigned yet");

    getContextMock.mockResolvedValue(context({ status: "completed" }));
    expect(await render()).toContain("not active");
  });
});
