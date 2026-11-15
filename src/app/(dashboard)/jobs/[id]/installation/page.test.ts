import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getContextMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/installations/lib/get-installation-context", () => ({
  getInstallationContext: getContextMock,
}));

vi.mock("@/features/installations/actions/record-installation.action", () => ({
  recordInstallationAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  useRouter: () => ({ refresh: vi.fn() }),
}));

import InstallationPage from "@/app/(dashboard)/jobs/[id]/installation/page";

function context(overrides: Record<string, unknown> = {}) {
  return {
    job: {
      id: "j-1",
      job_number: "JOB-2026-0081",
      status: "in_progress",
      job_type: "installation",
      technician_id: "t-1",
    },
    booking: {
      booking_number: "BK-00002",
      airport: { code: "DXB", name: "Dubai", timezone: "Asia/Dubai" },
      seat: {
        id: "s-1",
        serial_number: "SN-2",
        status: "available",
        category_name: "Infant",
      },
    },
    installation: null,
    ...overrides,
  };
}

async function render() {
  return renderToStaticMarkup(
    await InstallationPage({ params: Promise.resolve({ id: "j-1" }) }),
  );
}

describe("InstallationPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "t-1", role: "technician" });
    getContextMock.mockReset();
    getContextMock.mockResolvedValue(context());
    notFoundMock.mockClear();
  });

  it("should guard the page with the installation permissions", async () => {
    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "installation:perform",
      "technicians:manage",
    ]);
  });

  it("should propagate the guard's redirect without loading the job", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getContextMock).not.toHaveBeenCalled();
  });

  it("should show the forbidden state with a link to the jobs when the job is not the user's", async () => {
    getContextMock.mockResolvedValue(null);

    const html = await render();

    expect(html).toContain("You cannot record this installation");
    expect(html).toContain("not found or is not assigned to you");
    expect(html).toContain('href="/jobs"');
    expect(html).not.toContain("Installation time");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("should call notFound when the job is not an installation job", async () => {
    getContextMock.mockResolvedValue(
      context({ job: { ...context().job, job_type: "cleaning" } }),
    );

    await expect(render()).rejects.toThrow("NOT_FOUND");
  });

  it("should open the form on the checklist with the job and booking numbers", async () => {
    const html = await render();

    expect(html).toContain("Installation checklist");
    expect(html).toContain("JOB-2026-0081 · BK-00002 · Asia/Dubai");
    expect(html).toContain("Continue to photos");
    expect(html).not.toContain("Installation time");
  });

  it.each([["available"], ["reserved"]])(
    "should show the form when the seat is %s",
    async (status) => {
      getContextMock.mockResolvedValue(
        context({
          booking: {
            ...context().booking,
            seat: { ...context().booking.seat, status },
          },
        }),
      );

      expect(await render()).toContain("Installation checklist");
    },
  );

  it.each([
    ["quarantine", "Quarantine"],
    ["in_use", "In use"],
    ["cleaning", "Cleaning"],
    ["inspection", "Inspection"],
    ["retired", "Retired"],
  ])(
    "should say the seat status is %s and not show the form",
    async (status, label) => {
      getContextMock.mockResolvedValue(
        context({
          booking: {
            ...context().booking,
            seat: { ...context().booking.seat, status },
          },
        }),
      );

      const html = await render();

      expect(html).toContain(`The seat status is ${label}`);
      expect(html).not.toContain("Installation time");
    },
  );

  it("should show the recorded installation read-only instead of the form", async () => {
    getContextMock.mockResolvedValue(
      context({
        installation: {
          id: "i-1",
          completed_at: "2026-10-16T08:00:00Z",
          notes: "Fitted",
          created_at: "2026-10-16T08:05:00Z",
          seat_serial_number: "SN-2",
          recorded_by: "Ahmed",
        },
      }),
    );

    const html = await render();

    expect(html).toContain("Recorded by");
    expect(html).toContain("Ahmed");
    expect(html).not.toContain("Cancel");
  });

  it("should say an installation cannot be recorded on a job that is not active", async () => {
    getContextMock.mockResolvedValue(
      context({ job: { ...context().job, status: "completed" } }),
    );

    const html = await render();

    expect(html).toContain("not active");
    expect(html).not.toContain("Installation time");
  });

  it("should say the booking has no seat yet when it has none", async () => {
    getContextMock.mockResolvedValue(
      context({ booking: { ...context().booking, seat: null } }),
    );

    const html = await render();

    expect(html).toContain("no seat assigned");
    expect(html).not.toContain("Installation time");
  });
});
