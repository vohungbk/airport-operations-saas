import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/jobs/hooks/use-job-form", () => ({
  useJobForm: hookMock,
}));

// Static markup has no form context, so the controlled field renders with an empty value.
vi.mock("react-hook-form", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-hook-form")>()),
  Controller: ({
    render,
  }: {
    render: (props: { field: { value: string; onChange: () => void } }) => unknown;
  }) => render({ field: { value: "", onChange: () => {} } }),
}));

import { JobEditMeta, formatLastUpdated } from "@/features/jobs/components/job-edit-meta";
import { JobForm, type JobFormEdit } from "@/features/jobs/components/job-form";
import { JobFormSkeleton } from "@/features/jobs/components/job-form-page";
import type { JobForEdit } from "@/features/jobs/lib/get-job-for-edit";

const OPTIONS = {
  technicians: [
    { value: "t-1", label: "Amir Khan", is_active: true, airport_code: "DXB" },
  ],
  bookings: [{ value: "b-1", label: "BK-2048" }],
};

const EDIT: JobFormEdit = {
  jobId: "j-1",
  bookingNumber: "BK-2048",
  defaultValues: { job_type: "inspection", technician_id: "t-1", booking_id: "b-1" },
};

function hookState(
  result: unknown = null,
  errors: Record<string, unknown> = {},
  isPending = false,
) {
  return {
    form: {
      register: () => ({}),
      control: {},
      formState: { errors },
    },
    onSubmit: vi.fn(),
    isPending,
    result,
  };
}

function render(edit?: JobFormEdit) {
  return renderToStaticMarkup(createElement(JobForm, { options: OPTIONS, edit }));
}

describe("JobForm", () => {
  beforeEach(() => {
    hookMock.mockReset();
  });

  it("should show job type, technician and booking choices with Save and Cancel to the job list", () => {
    hookMock.mockReturnValue(hookState());

    const html = render();

    expect(html).toContain("Job assignment");
    expect(html).toContain("Choose a job type, technician and related record.");
    for (const label of ["Installation", "Cleaning", "Inspection"]) {
      expect(html).toContain(`>${label}</option>`);
    }
    expect(html).toContain("Select technician");
    expect(html).toContain(">BK-2048</option>");
    expect(html).toContain('href="/jobs"');
    expect(html).toContain(">Save<");
  });

  it("should show the booking as read-only text and Cancel back to the job on an edit", () => {
    hookMock.mockReturnValue(hookState());

    const html = render(EDIT);

    expect(html).toContain("Job status is changed from Job detail.");
    expect(html).toContain("The booking cannot be changed");
    expect(html).not.toContain('id="booking_id"');
    expect(html).toContain('href="/jobs/j-1"');
  });

  it("should show the field error and not the hint when validation fails", () => {
    hookMock.mockReturnValue(
      hookState(null, { job_type: { type: "custom", message: "Select a job type." } }),
    );

    const html = render();

    expect(html).toContain("Select a job type.");
    expect(html).not.toContain("Installation, Cleaning or Inspection");
  });

  it("should disable Save and say Saving while the job is being saved", () => {
    hookMock.mockReturnValue(hookState(null, {}, true));

    const html = render();

    expect(html).toContain("Saving...");
    expect(html).toContain("disabled");
  });

  it("should show the failure above the fields when the save fails", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: { code: "TECHNICIAN_INACTIVE", message: "This technician is not active." },
      }),
    );

    const html = render(EDIT);

    expect(html).toContain("Could not save job");
    expect(html).toContain("This technician is not active.");
  });
});

describe("JobEditMeta", () => {
  const JOB: JobForEdit = {
    id: "j-1",
    job_number: "JB-0142",
    status: "in_progress",
    job_type: "inspection",
    technician_id: "t-1",
    updated_at: "2026-11-11T06:42:00Z",
    booking: { id: "b-1", booking_number: "BK-2048", airport: { timezone: "Asia/Dubai" } },
  };

  it("should show the job number, status and last updated time in the airport time zone", () => {
    const html = renderToStaticMarkup(createElement(JobEditMeta, { job: JOB }));

    expect(html).toContain("JB-0142");
    expect(html).toContain("In progress");
    expect(html).toContain("11 Nov 2026, 10:42 GST");
  });

  it("should write the last updated time in UTC when the booking has no airport", () => {
    expect(formatLastUpdated("2026-11-11T06:42:00Z", "UTC")).toBe("11 Nov 2026, 06:42 UTC");
  });
});

describe("JobFormSkeleton", () => {
  it("should announce loading and show the meta strip only for an edit", () => {
    const create = renderToStaticMarkup(
      createElement(JobFormSkeleton, { cardDescription: "A" }),
    );
    const edit = renderToStaticMarkup(
      createElement(JobFormSkeleton, { cardDescription: "A", withMeta: true }),
    );

    expect(create).toContain('aria-busy="true"');
    expect(edit.match(/animate-pulse/g)?.length).toBeGreaterThan(
      create.match(/animate-pulse/g)?.length ?? 0,
    );
  });
});
