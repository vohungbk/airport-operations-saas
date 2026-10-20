import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MetricTile } from "@/features/dashboard/components/metric-tile";
import { DASHBOARD_METRICS } from "@/features/dashboard/lib/dashboard-metrics";

const metric = DASHBOARD_METRICS.find((m) => m.id === "jobs_in_progress")!;

const render = (value: number | null) =>
  renderToStaticMarkup(createElement(MetricTile, { metric, value }));

describe("MetricTile", () => {
  it("should show the label, the figure, the formula and a link to the list", () => {
    const html = render(5);

    expect(html).toContain("Jobs in progress");
    expect(html).toContain(">5<");
    expect(html).toContain("Jobs whose status is in progress");
    expect(html).toContain('href="/jobs?status=in_progress"');
  });

  it("should show a real zero as 0", () => {
    expect(render(0)).toContain(">0<");
  });

  it("should say Unavailable, and no number, when the figure could not be read", () => {
    const html = render(null);

    expect(html).toContain("Unavailable");
    expect(html).not.toContain(">0<");
  });
});
