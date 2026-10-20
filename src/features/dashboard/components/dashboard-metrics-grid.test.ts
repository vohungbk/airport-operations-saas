import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardMetricsGrid } from "@/features/dashboard/components/dashboard-metrics-grid";
import { DASHBOARD_METRICS } from "@/features/dashboard/lib/dashboard-metrics";

const all = DASHBOARD_METRICS.map((metric) => ({ metric, value: 1 }));

const render = (results: typeof all) =>
  renderToStaticMarkup(createElement(DashboardMetricsGrid, { results }));

describe("DashboardMetricsGrid", () => {
  it("should group the tiles by module, in order", () => {
    const html = render(all);

    const order = ["Inventory", "Bookings", "Jobs", "Incidents"].map((name) =>
      html.indexOf(`>${name}<`),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("should keep a figure that is not available yet in its module and label it", () => {
    const html = render(
      all.map((result) =>
        result.metric.module === "inventory"
          ? { ...result, value: null as never, reason: "not_released" as const }
          : result,
      ),
    );

    expect(html).toContain(">Inventory<");
    expect(html).toContain("Not available yet");
    expect(html).not.toContain('href="/seats');
  });

  it("should leave out the section of a module that has no tile", () => {
    const html = render(all.filter(({ metric }) => metric.module !== "inventory"));

    expect(html).not.toContain(">Inventory<");
    expect(html).toContain(">Bookings<");
  });
});
