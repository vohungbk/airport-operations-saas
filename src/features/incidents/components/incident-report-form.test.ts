import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/incidents/hooks/use-report-incident-form", () => ({
  useReportIncidentForm: hookMock,
}));

import { IncidentReportForm } from "@/features/incidents/components/incident-report-form";

const JOBS = [
  { id: "j-1", job_type: "inspection" as const, booking_number: "BK-00002" },
  { id: "j-2", job_type: "cleaning" as const, booking_number: "BK-00004" },
];

function hookState(result: unknown, errors: Record<string, unknown> = {}) {
  return {
    form: { register: () => ({}), formState: { errors } },
    onSubmit: vi.fn(),
    isPending: false,
    result,
  };
}

function render(cancelHref = "/incidents") {
  return renderToStaticMarkup(
    createElement(IncidentReportForm, {
      jobs: JOBS,
      initialJobId: "",
      cancelHref,
    }),
  );
}

describe("IncidentReportForm", () => {
  beforeEach(() => {
    hookMock.mockReset();
  });

  it("should show the job and severity choices with none selected, a description, Save and Cancel", () => {
    hookMock.mockReturnValue(hookState(null));

    const html = render();

    expect(html).toContain("BK-00002 - Inspection");
    expect(html).toContain("BK-00004 - Cleaning");
    for (const label of ["Low", "Medium", "High", "Critical"]) {
      expect(html).toContain(`>${label}</option>`);
    }
    expect(html).toContain("Select a job");
    expect(html).toContain("Select a severity");
    expect(html).not.toMatch(/<option[^>]*selected/);
    expect(html).toContain('id="description"');
    expect(html).toContain(">Save<");
    expect(html).toContain('href="/incidents"');
    expect(html).not.toContain("Could not report incident");
  });

  it("should send Cancel back to the jobs for a technician", () => {
    hookMock.mockReturnValue(hookState(null));

    expect(render("/jobs")).toContain('href="/jobs"');
  });

  it("should show a clear message for the job, the severity and the description", () => {
    hookMock.mockReturnValue(
      hookState(null, {
        job_id: { message: "Choose the related job." },
        severity: { message: "Choose the severity." },
        description: { message: "Describe what happened." },
      }),
    );

    const html = render();

    expect(html).toContain("Choose the related job.");
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
