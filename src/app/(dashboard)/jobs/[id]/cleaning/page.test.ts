import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getContextMock = vi.hoisted(() => vi.fn());
const getJobByIdMock = vi.hoisted(() => vi.fn());
const getConflictMock = vi.hoisted(() => vi.fn());
const getLastWorkMock = vi.hoisted(() => vi.fn());
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

vi.mock("@/features/jobs/lib/get-job-by-id", () => ({
  getJobById: getJobByIdMock,
}));

vi.mock("@/features/cleaning/lib/get-seat-booking-conflict", () => ({
  getSeatBookingConflict: getConflictMock,
}));

vi.mock("@/features/jobs/lib/get-seat-last-work", () => ({
  getSeatLastWork: getLastWorkMock,
}));

vi.mock("@/features/cleaning/actions/start-cleaning.action", () => ({
  startCleaningAction: vi.fn(),
}));

vi.mock("@/features/cleaning/actions/complete-cleaning.action", () => ({
  completeCleaningAction: vi.fn(),
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
      id: "b-1",
      booking_number: "BK-00002",
      airport: { code: "DXB", name: "Dubai", timezone: "Asia/Dubai" },
      seat: {
        id: "s-1",
        serial_number: "SN-2",
        status: "available",
        quarantine_reason: null,
        category_name: "Infant",
      },
    },
    cleaning: null,
    ...overrides,
  };
}

function jobDetail() {
  return {
    id: "j-1",
    job_number: "JOB-2026-000123",
    status: "in_progress",
    job_type: "cleaning",
    created_at: "2026-11-04T04:00:00Z",
    deadline_at: null,
    technician: { id: "t-1", full_name: "Omar Haddad" },
    booking: {
      id: "b-1",
      booking_number: "BK-00002",
      partner: { name: "Emirates Rent A Car" },
      pickup_at: "2026-11-05T05:00:00Z",
      airport: { code: "DXB", name: "Dubai", city: "Dubai", timezone: "Asia/Dubai" },
    },
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
    getJobByIdMock.mockReset();
    getJobByIdMock.mockResolvedValue(jobDetail());
    getConflictMock.mockReset();
    getConflictMock.mockResolvedValue(null);
    getLastWorkMock.mockReset();
    getLastWorkMock.mockResolvedValue({
      cleaning: { at: "2026-11-03T13:20:00Z", outcome: "Success" },
      inspection: null,
    });
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
    expect(html).not.toContain("Start cleaning");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("should call notFound when the job is not a cleaning job", async () => {
    getContextMock.mockResolvedValue(
      context({ job: { ...context().job, job_type: "installation" } }),
    );

    await expect(render()).rejects.toThrow("NOT_FOUND");
  });

  it("should show the Start step with the seat and a Cancel link when the cleaning is not started", async () => {
    const html = await render();

    expect(html).toContain("SN-2 (Infant)");
    expect(html).toContain("Start cleaning");
    expect(html).not.toContain("Complete cleaning");
    expect(html).toContain('href="/jobs/j-1"');
    expect(html).toContain("Cancel");
  });

  describe("for Admin and Operations Manager", () => {
    beforeEach(() => {
      requireAnyPermissionMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    });

    it("should show Not started with Start cleaning, the last cleaning and the job cards", async () => {
      const html = await render();

      expect(html).toContain("Start cleaning");
      expect(html).toContain("Last cleaning: 03 Nov 2026 17:20 GST · Success");
      expect(html).toContain("JOB-2026-000123");
      expect(html).toContain("Emirates Rent A Car");
      expect(html).toContain("Cleaning history is retained. No records can be deleted.");
      expect(html).not.toContain("You cannot record this cleaning");
    });

    it("should block Start with the booking link and period when a booking holds the seat", async () => {
      getConflictMock.mockResolvedValue({
        id: "b-9",
        booking_number: "BK-2026-000900",
        pickup_at: "2026-11-04T05:00:00Z",
        return_at: "2026-11-04T13:00:00Z",
      });

      const html = await render();

      expect(html).toContain("Start cleaning - blocked");
      expect(html).toContain('href="/bookings/b-9"');
      expect(html).toContain("04 Nov 2026 09:00 GST - 04 Nov 2026 17:00 GST");
    });

    it("should show the Quarantine reason and Create incident after a failed cleaning", async () => {
      getContextMock.mockResolvedValue(
        context({
          booking: {
            ...context().booking,
            seat: {
              ...context().booking.seat,
              status: "quarantine",
              quarantine_reason: "persistent contamination on harness",
            },
          },
          cleaning: {
            id: "c-1",
            started_at: "2026-11-04T07:00:00Z",
            completed_at: "2026-11-04T07:18:00Z",
            passed: false,
            notes: "Sticky",
            created_at: "2026-11-04T07:00:00Z",
            seat_serial_number: "SN-2",
            recorded_by: "Omar Haddad",
          },
        }),
      );

      const html = await render();

      expect(html).toContain("persistent contamination on harness");
      expect(html).toContain('href="/incidents/new?job_id=j-1"');
      expect(html).toContain("Recorded by Omar Haddad");
      expect(getConflictMock).not.toHaveBeenCalled();
    });

    it("should say the seat status instead of offering Start when the seat is not available and nothing blocks it", async () => {
      getContextMock.mockResolvedValue(
        context({
          booking: {
            ...context().booking,
            seat: { ...context().booking.seat, status: "inspection" },
          },
        }),
      );

      const html = await render();

      expect(html).toContain("The seat status is Inspection");
      expect(html).not.toContain("Start cleaning");
    });
  });

  it("should keep the technician screen, with no job cards, for a technician", async () => {
    const html = await render();

    expect(html).toContain("Cancel");
    expect(html).not.toContain("Cleaning history is retained");
    expect(getJobByIdMock).not.toHaveBeenCalled();
  });

  it.each([
    ["reserved", "Reserved"],
    ["in_use", "In use"],
    ["cleaning", "Cleaning"],
    ["inspection", "Inspection"],
    ["quarantine", "Quarantine"],
    ["retired", "Retired"],
  ])(
    "should say the seat status is %s and not offer Start",
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
      expect(html).not.toContain("Start cleaning");
    },
  );

  it("should show the Complete step with the start time and a result to choose when the cleaning is in progress", async () => {
    getContextMock.mockResolvedValue(
      context({
        booking: {
          ...context().booking,
          seat: { ...context().booking.seat, status: "cleaning" },
        },
        cleaning: {
          id: "c-1",
          started_at: "2026-10-16T08:00:00Z",
          completed_at: null,
          passed: null,
          notes: null,
          created_at: "2026-10-16T08:00:00Z",
          seat_serial_number: "SN-2",
          recorded_by: "Ahmed",
        },
      }),
    );

    const html = await render();

    expect(html).toContain("Complete cleaning");
    expect(html).toContain("by Ahmed");
    expect(html).toContain("Passed");
    expect(html).toContain("Failed");
    expect(html).not.toContain("Start cleaning");
  });

  it.each([
    [true, "Passed"],
    [false, "Failed"],
  ])(
    "should show the completed cleaning read-only with the result (passed %s)",
    async (passed, label) => {
      getContextMock.mockResolvedValue(
        context({
          cleaning: {
            id: "c-1",
            started_at: "2026-10-16T08:00:00Z",
            completed_at: "2026-10-16T08:20:00Z",
            passed,
            notes: "Wiped",
            created_at: "2026-10-16T08:00:00Z",
            seat_serial_number: "SN-2",
            recorded_by: "Ahmed",
          },
        }),
      );

      const html = await render();

      expect(html).toContain("Done by");
      expect(html).toContain("Ahmed");
      expect(html).toContain(label);
      expect(html).not.toContain("Start cleaning");
      expect(html).not.toContain("Complete cleaning");
    },
  );

  it("should say a cleaning cannot be started on a job that is not active", async () => {
    getContextMock.mockResolvedValue(
      context({ job: { ...context().job, status: "completed" } }),
    );

    const html = await render();

    expect(html).toContain("not active");
    expect(html).not.toContain("Start cleaning");
  });

  it("should say the booking has no seat yet when it has none", async () => {
    getContextMock.mockResolvedValue(
      context({ booking: { ...context().booking, seat: null } }),
    );

    const html = await render();

    expect(html).toContain("no seat assigned");
    expect(html).not.toContain("Start cleaning");
  });
});
