import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JobActionErrorAlert } from "@/features/jobs/components/job-action-error-alert";

function render(
  code: "NOT_FOUND" | "FORBIDDEN" | "STALE_DATA" | "NETWORK_ERROR",
  message: string,
) {
  return renderToStaticMarkup(
    createElement(JobActionErrorAlert, { error: { code, message } }),
  );
}

describe("JobActionErrorAlert", () => {
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

  it("should say the user no longer has access when the action is forbidden", () => {
    expect(render("FORBIDDEN", "You do not have permission to do this.")).toContain(
      "You no longer have access to this action",
    );
  });

  it("should keep the form usable after a network error", () => {
    const html = render("NETWORK_ERROR", "Could not reach the server.");

    expect(html).toContain("Could not update status");
    expect(html).not.toContain('href="/jobs"');
  });

  it("should not offer the job list for an error a retry can fix", () => {
    const html = render("STALE_DATA", "This job was changed by someone else.");

    expect(html).toContain("Could not update status");
    expect(html).not.toContain('href="/jobs"');
  });

  it("should use the given title for an error a retry can fix", () => {
    const html = renderToStaticMarkup(
      createElement(JobActionErrorAlert, {
        error: { code: "NETWORK_ERROR", message: "Could not reach the server." },
        fallbackTitle: "Could not record installation",
      }),
    );

    expect(html).toContain("Could not record installation");
    expect(html).not.toContain("Could not update status");
  });
});
