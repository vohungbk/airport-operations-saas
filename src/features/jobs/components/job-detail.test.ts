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

function render(workRecordHref: string | null) {
  return renderToStaticMarkup(
    createElement(JobDetail, {
      job: JOB,
      events: [],
      eventsTruncated: false,
      allowedStatuses: [],
      workRecordHref,
    }),
  );
}

describe("JobDetail", () => {
  it("should link Record work to the workflow screen when one is offered", () => {
    const html = render("/jobs/j-1/installation");

    expect(html).toContain('href="/jobs/j-1/installation"');
    expect(html).toContain("Record work");
  });

  it("should not show Record work when no workflow is offered", () => {
    expect(render(null)).not.toContain("Record work");
  });
});
