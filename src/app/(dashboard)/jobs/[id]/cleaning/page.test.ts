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

vi.mock("@/features/cleaning/lib/get-cleaning-context", () => ({
  getCleaningContext: getContextMock,
}));

vi.mock("@/features/cleaning/actions/record-cleaning.action", () => ({
  recordCleaningAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  useRouter: () => ({ refresh: vi.fn() }),
}));

import CleaningPage from "@/app/(dashboard)/jobs/[id]/cleaning/page";

function context(overrides: Record<string, unknown> = {}) {
  return {
    job: {
      id: "j-1",
      status: "in_progress",
      job_type: "cleaning",
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
    cleaning: null,
    ...overrides,
  };
}

async function render() {
  return renderToStaticMarkup(
    await CleaningPage({ params: Promise.resolve({ id: "j-1" }) }),
  );
}

describe("CleaningPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "t-1", role: "technician" });
    getContextMock.mockReset();
    getContextMock.mockResolvedValue(context());
    notFoundMock.mockClear();
  });

  it("should guard the page with the cleaning permissions", async () => {
    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "cleaning:create",
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

    expect(html).toContain("You cannot record this cleaning");
    expect(html).toContain("not found or is not assigned to you");
    expect(html).toContain('href="/jobs"');
    expect(html).not.toContain("Cleaning time");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("should call notFound when the job is not a cleaning job", async () => {
    getContextMock.mockResolvedValue(
      context({ job: { ...context().job, job_type: "installation" } }),
    );

    await expect(render()).rejects.toThrow("NOT_FOUND");
  });

  it("should show the form with the booking's seat and a Cancel link back to the job", async () => {
    const html = await render();

    expect(html).toContain("SN-2 (Infant)");
    expect(html).toContain("Cleaning time");
    expect(html).toContain('href="/jobs/j-1"');
    expect(html).toContain("Cancel");
  });

  it.each([["available"], ["reserved"], ["in_use"], ["cleaning"], ["quarantine"]])(
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

      expect(await render()).toContain("Cleaning time");
    },
  );

  it("should say the seat status is Retired and not show the form", async () => {
    getContextMock.mockResolvedValue(
      context({
        booking: {
          ...context().booking,
          seat: { ...context().booking.seat, status: "retired" },
        },
      }),
    );

    const html = await render();

    expect(html).toContain("The seat status is Retired");
    expect(html).not.toContain("Cleaning time");
  });

  it("should show the form to an internal user on a job assigned to a technician", async () => {
    requireAnyPermissionMock.mockResolvedValue({ id: "admin-1", role: "admin" });

    const html = await render();

    expect(html).toContain("Cleaning time");
    expect(html).not.toContain("You cannot record this cleaning");
  });

  it("should show the recorded cleaning read-only instead of the form", async () => {
    getContextMock.mockResolvedValue(
      context({
        cleaning: {
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

  it("should say a cleaning cannot be recorded on a job that is not active", async () => {
    getContextMock.mockResolvedValue(
      context({ job: { ...context().job, status: "completed" } }),
    );

    const html = await render();

    expect(html).toContain("not active");
    expect(html).not.toContain("Cleaning time");
  });

  it("should say the booking has no seat yet when it has none", async () => {
    getContextMock.mockResolvedValue(
      context({ booking: { ...context().booking, seat: null } }),
    );

    const html = await render();

    expect(html).toContain("no seat assigned");
    expect(html).not.toContain("Cleaning time");
  });
});
