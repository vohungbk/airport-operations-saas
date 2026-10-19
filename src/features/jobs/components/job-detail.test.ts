import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JobDetail } from "@/features/jobs/components/job-detail";
import type { JobDetailItem } from "@/features/jobs/types";

const JOB: JobDetailItem = {
  id: "j-1",
  status: "in_progress",
  job_type: "installation",
  assigned_at: "2026-10-16T08:00:00Z",
  started_at: null,
  completed_at: null,
  vehicle_bay: null,
  installation_notes: null,
  technician: { id: "t-1", full_name: "Ahmed" },
  booking: null,
};

function render(
  workRecordHref: string | null,
  reportIncidentHref?: string | null,
) {
  return renderToStaticMarkup(
    createElement(JobDetail, {
      job: JOB,
      events: [],
      eventsTruncated: false,
      allowedStatuses: [],
      workRecordHref,
      reportIncidentHref,
    }),
  );
}

describe("JobDetail", () => {
  it("should link Record work to the workflow screen when one is offered", () => {
    const html = render("/jobs/j-1/installation");

    expect(html).toContain('href="/jobs/j-1/installation"');
    expect(html).toContain("Record work");
  });

  it("should link Report incident to the report form when it is offered", () => {
    const html = render(null, "/incidents/new?job_id=j-1");

    expect(html).toContain('href="/incidents/new?job_id=j-1"');
    expect(html).toContain("Report incident");
  });

  it("should not show Report incident when it is not offered", () => {
    expect(render(null)).not.toContain("Report incident");
    expect(render(null, null)).not.toContain("Report incident");
  });

  it("should not show Record work when no workflow is offered", () => {
    expect(render(null)).not.toContain("Record work");
  });
});
