import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookMock = vi.hoisted(() => vi.fn());
const photoMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/bookings/hooks/use-step-photo-upload", () => ({
  useStepPhotoUpload: photoMock,
}));

vi.mock("@/features/incidents/hooks/use-report-incident-form", () => ({
  useReportIncidentForm: hookMock,
}));

import { IncidentReportForm } from "@/features/incidents/components/incident-report-form";

const JOBS = [
  { id: "j-1", job_type: "inspection" as const, booking_id: "b-1", booking_number: "BK-00002", seat_number: "SEAT-0001" },
  { id: "j-2", job_type: "cleaning" as const, booking_id: "b-2", booking_number: "BK-00004", seat_number: "SEAT-0002" },
];

function photoState(uploaded: boolean) {
  return {
    items: uploaded ? [{ id: "p-1", file_name: "seat.jpg", status: "uploaded" as const }] : [],
    errors: [],
    addFiles: vi.fn(),
    retry: vi.fn(),
    remove: vi.fn(),
    hasPhoto: uploaded,
    isUploading: false,
    canSave: uploaded,
  };
}

function hookState(
  result: unknown,
  errors: Record<string, unknown> = {},
  jobId = "",
) {
  return {
    form: {
      register: () => ({}),
      watch: () => jobId,
      formState: { errors },
    },
    onSubmit: vi.fn(),
    isPending: false,
    result,
  };
}

function render(cancelHref = "/incidents") {
  return renderToStaticMarkup(
    createElement(IncidentReportForm, {
      jobs: JOBS,
      reportedAt: "04 Nov 2026 11:15 GST",
      zone: "GST",
      initialJobId: "",
      cancelHref,
    }),
  );
}

describe("IncidentReportForm", () => {
  beforeEach(() => {
    hookMock.mockReset();
    photoMock.mockReset();
    photoMock.mockReturnValue(photoState(true));
  });

  it("should show the seat and severity choices with none selected, a description, Submit incident and Cancel", () => {
    hookMock.mockReturnValue(hookState(null));

    const html = render();

    expect(html).toContain("SEAT-0001 - BK-00002 - Inspection");
    expect(html).toContain("SEAT-0002 - BK-00004 - Cleaning");
    for (const label of ["Low", "Medium", "High", "Critical"]) {
      expect(html).toContain(`>${label}</option>`);
    }
    expect(html).toContain("Select a seat");
    expect(html).toContain("Select severity");
    expect(html).not.toMatch(/<option[^>]*selected/);
    expect(html).toContain('id="description"');
    expect(html).toContain(">Submit incident<");
    expect(html).toContain('href="/incidents"');
    expect(html).not.toContain("Could not report incident");
  });

  it("should mark the required fields and show the helper texts of the design", () => {
    hookMock.mockReturnValue(hookState(null));

    const html = render();

    expect(html.match(/aria-hidden="true"> \*/g)).toHaveLength(3);
    expect(html).toContain("Booking (optional)");
    expect(html).toContain("Required - include fault and immediate action");
    expect(html).toContain("Set when you submit - airport time zone GST");
    expect(html).toContain(">04 Nov 2026 11:15 GST<");
  });

  it("should fill the booking from the chosen job", () => {
    hookMock.mockReturnValue(hookState(null, {}, "j-2"));

    expect(render()).toContain(">BK-00004<");
  });

  it("should say the photos are required and keep Submit incident off until one is stored", () => {
    hookMock.mockReturnValue(hookState(null, {}, "j-1"));
    photoMock.mockReturnValue(photoState(false));

    const html = render();

    expect(html).toContain("Photos (required)");
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Submit incident</);
    expect(photoMock).toHaveBeenCalledWith("b-1", "incident");
  });

  it("should ask for a seat before photos can be added", () => {
    hookMock.mockReturnValue(hookState(null));
    photoMock.mockReturnValue(photoState(false));

    expect(render()).toContain("Select a seat first, then add at least one photo.");
    expect(photoMock).toHaveBeenCalledWith("", "incident");
  });

  it("should let the user submit once a photo is stored", () => {
    hookMock.mockReturnValue(hookState(null, {}, "j-1"));

    expect(render()).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Submit incident</);
  });

  it("should send Cancel back to the jobs for a technician", () => {
    hookMock.mockReturnValue(hookState(null));

    expect(render("/jobs")).toContain('href="/jobs"');
  });

  it("should show a clear message for the job, the severity and the description", () => {
    hookMock.mockReturnValue(
      hookState(null, {
        job_id: { message: "Choose the seat." },
        severity: { message: "Choose the severity." },
        description: { message: "Describe what happened." },
      }),
    );

    const html = render();

    expect(html).toContain("Choose the seat.");
    expect(html).toContain("Choose the severity.");
    expect(html).toContain("Describe what happened.");
  });

  it("should keep the form and tell the user to retry after a network failure", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message:
            "Could not reach the server. Your input is kept; check your connection and try again.",
        },
      }),
    );

    const html = render();

    expect(html).toContain("Could not report incident");
    expect(html).toContain("Your input is kept");
    expect(html).toContain('id="description"');
  });

  it("should say access was lost and point back to the jobs when the database denies the report", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to do this.",
        },
      }),
    );

    const html = render();

    expect(html).toContain("You no longer have access to this action");
    expect(html).toContain('href="/jobs"');
  });
});
