import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IncidentActionErrorAlert } from "@/features/incidents/components/incident-action-error-alert";
import type { JobActionError } from "@/features/jobs/lib/job-errors";

function render(error: JobActionError, fallbackTitle?: string) {
  return renderToStaticMarkup(
    createElement(IncidentActionErrorAlert, { error, fallbackTitle }),
  );
}

describe("IncidentActionErrorAlert", () => {
  it("should tell the user their input is kept after a network failure, with no way out of the form", () => {
    const html = render({
      code: "NETWORK_ERROR",
      message:
        "Could not reach the server. Your input is kept; check your connection and try again.",
    });

    expect(html).toContain("Could not update status");
    expect(html).toContain("Your input is kept");
    expect(html).not.toContain('href="/incidents"');
  });

  it("should say the incident was changed by someone else and let the user retry", () => {
    const html = render({
      code: "STALE_DATA",
      message:
        "This incident was changed by someone else. The latest status is shown; review it and try again.",
    });

    expect(html).toContain("changed by someone else");
    expect(html).toContain("Could not update status");
    expect(html).not.toContain('href="/incidents"');
  });

  it("should say the change is not allowed and let the user retry", () => {
    const html = render({
      code: "INVALID_TRANSITION",
      message: "This change is not allowed for the incident in its current status.",
    });

    expect(html).toContain("not allowed");
    expect(html).not.toContain('href="/incidents"');
  });

  it("should say the incident is no longer available and point back to the list", () => {
    const html = render({
      code: "NOT_FOUND",
      message: "This incident was not found or is not within your access.",
    });

    expect(html).toContain("This incident is no longer available");
    expect(html).toContain('href="/incidents"');
    expect(html).toContain("Back to incidents");
  });

  it("should say access was lost and point back to the list when the role no longer allows the change", () => {
    const html = render({
      code: "FORBIDDEN",
      message: "You do not have permission to change this incident.",
    });

    expect(html).toContain("You no longer have access to this action");
    expect(html).toContain('href="/incidents"');
  });

  it("should use the title of the action the user was doing for an error a retry can fix", () => {
    const html = render(
      { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      "Could not report incident",
    );

    expect(html).toContain("Could not report incident");
  });

  it("should never talk about a job", () => {
    for (const code of ["NOT_FOUND", "FORBIDDEN", "STALE_DATA"] as const) {
      expect(render({ code, message: "x" })).not.toMatch(/\bjob\b/i);
    }
  });
});
