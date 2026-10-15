import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JobStatusErrorAlert } from "@/features/jobs/components/job-status-error-alert";

function render(code: "NOT_FOUND" | "FORBIDDEN" | "STALE_DATA", message: string) {
  return renderToStaticMarkup(
    createElement(JobStatusErrorAlert, { error: { code, message } }),
  );
}

describe("JobStatusErrorAlert", () => {
  it("should point back to the job list when the job is no longer available", () => {
    const html = render(
      "NOT_FOUND",
      "This job was not found or is no longer assigned to you.",
    );

    expect(html).toContain("This job is no longer available");
    expect(html).toContain("no longer assigned to you");
    expect(html).toContain('href="/jobs"');
  });

  it("should point back to the job list when the user is no longer allowed", () => {
    expect(render("FORBIDDEN", "You do not have permission to do this.")).toContain(
      'href="/jobs"',
    );
  });

  it("should not offer the job list for an error a retry can fix", () => {
    const html = render("STALE_DATA", "This job was changed by someone else.");

    expect(html).toContain("Could not update status");
    expect(html).not.toContain('href="/jobs"');
  });
});
