import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import JobNotFound from "@/app/(dashboard)/jobs/[id]/not-found";

describe("JobNotFound", () => {
  it("should explain the job may be unassigned and link back to the job list", () => {
    const html = renderToStaticMarkup(createElement(JobNotFound));

    expect(html).toContain("Job not found");
    expect(html).toContain("no longer assigned to you");
    expect(html).toContain('href="/jobs"');
  });
});
