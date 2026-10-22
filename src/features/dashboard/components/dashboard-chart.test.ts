import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/dashboard/components/dashboard-retry-button", () => ({
  DashboardRetryButton: () => "RETRY_BUTTON",
}));

import { DashboardChart } from "@/features/dashboard/components/dashboard-chart";
import { DashboardMetricsGrid } from "@/features/dashboard/components/dashboard-metrics-grid";
import { DASHBOARD_CHARTS } from "@/features/dashboard/lib/dashboard-charts";
import { DASHBOARD_METRICS } from "@/features/dashboard/lib/dashboard-metrics";
import type { DashboardChartResult } from "@/features/dashboard/lib/get-dashboard-charts";

/**
 * VI-F01-S07: each chart shows a count, a word and a share for every bar (AC05),
 * says so when there is nothing to chart (AC06), never shows an unreadable count as
 * 0, and takes the width of its card (AC08).
 */
const chartDef = (id: string) => DASHBOARD_CHARTS.find((c) => c.id === id)!;

const resultOf = (id: string, values: Record<string, number | null>): DashboardChartResult => ({
  chart: chartDef(id),
  bars: chartDef(id).categories.map((category) => ({ category, value: category.key in values ? values[category.key] : 0 })),
});

const render = (result: DashboardChartResult) => renderToStaticMarkup(createElement(DashboardChart, { result }));

const SEATS = { available: 39, quarantine: 1 };

describe("DashboardChart (VI-F01-S07, spec R7, R8)", () => {
  it("should show the title and a row for every status of seats, with its word and its count (AC01)", () => {
    const html = render(resultOf("seats_by_status", SEATS));

    expect(html).toContain("Seats by status");
    for (const word of ["Available", "Reserved", "In use", "Cleaning", "Inspection", "Quarantine", "Retired"]) {
      expect(html, word).toContain(word);
    }
    expect(html.match(/<li /g)).toHaveLength(7);
    expect(html).toContain(">39<");
    expect(html).toContain("(98%)");
    expect(html).toContain("(3%)");
  });

  it("should show a row for every status of bookings (AC02) and of jobs (AC03)", () => {
    expect(render(resultOf("bookings_by_status", { pending: 2 })).match(/<li /g)).toHaveLength(7);
    expect(render(resultOf("jobs_by_status", { assigned: 2, in_progress: 1 })).match(/<li /g)).toHaveLength(4);
  });

  it("should list the open incidents with Critical first, with an icon and a heavier label, and not by colour alone (AC04, AC05)", () => {
    const html = render(resultOf("open_incidents_by_severity", { critical: 2, high: 1, medium: 3, low: 4 }));

    expect(html.indexOf("Critical")).toBeLessThan(html.indexOf("High"));
    expect(html.indexOf("High")).toBeLessThan(html.indexOf("Medium"));
    expect(html.indexOf("Medium")).toBeLessThan(html.indexOf("Low"));
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"[^>]*>/);
    expect(html).toContain("font-semibold");
    expect(html).toContain("text-destructive");
    expect(html.match(/<svg/g)).toHaveLength(1);
  });

  it("should keep the icon and the heavy label of Critical when it is 0, but not turn it red", () => {
    const html = render(resultOf("open_incidents_by_severity", { critical: 0, high: 2 }));

    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).toMatch(/font-semibold[^"]*text-foreground">[\s\S]*?Critical/);
    expect(html).not.toContain("text-destructive");
  });

  it("should give every row a word, a count and a share, so no status is told by colour alone (AC05)", () => {
    const html = render(resultOf("jobs_by_status", { assigned: 1, in_progress: 1, completed: 2, cancelled: 0 }));
    const rows = html.match(/<li [\s\S]*?<\/li>/g) ?? [];

    expect(rows).toHaveLength(4);
    for (const row of rows) {
      const text = row.replace(/<[^>]*>/g, " ");
      expect(text).toMatch(/[A-Za-z]{4,}/);
      expect(text).toMatch(/\d+\s+\(\d+%\)/);
    }
  });

  it("should hide the drawn bar from a screen reader, since the words say it (AC05)", () => {
    const html = render(resultOf("jobs_by_status", { assigned: 1 }));

    expect(html.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain('aria-labelledby="dashboard-chart-jobs_by_status"');
    expect(html).toContain('id="dashboard-chart-jobs_by_status"');
  });

  it("should set the width of a bar through a custom property, not through a fixed width", () => {
    const html = render(resultOf("jobs_by_status", { assigned: 1, completed: 3 }));

    expect(html).toContain("--bar:25%");
    expect(html).toContain("--bar:75%");
    expect(html).toContain("w-(--bar)");
    expect(html).not.toMatch(/style="[^"]*\bwidth:/);
  });

  it("should say there is nothing to chart, and draw no bar and no zero, when every count is zero (AC06)", () => {
    const html = render(resultOf("seats_by_status", {}));

    expect(html).toContain("No seats to chart yet.");
    expect(html).not.toContain("<li");
    expect(html).not.toContain("%)");
  });

  it("should say Unavailable, and not show zeros, when a count could not be read", () => {
    const html = render(resultOf("seats_by_status", { available: 5, retired: null }));

    expect(html).toContain("Unavailable");
    expect(html).not.toContain("<li");
    expect(html).not.toContain("(0%)");
  });

  it("should offer a retry on a chart that is unavailable, even when the cards were read", () => {
    expect(render(resultOf("jobs_by_status", { assigned: null }))).toContain("RETRY_BUTTON");
    expect(render(resultOf("jobs_by_status", { assigned: 2 }))).not.toContain("RETRY_BUTTON");
    expect(render(resultOf("jobs_by_status", {}))).not.toContain("RETRY_BUTTON");
  });

  it("should take the width of its card and never scroll sideways (AC08)", () => {
    const html = render(resultOf("seats_by_status", SEATS));

    expect(html).not.toContain("overflow-x");
    expect(html).not.toMatch(/(^|[\s"])w-(\d{2,3}|\[\d+px\])([\s"])/);
    expect(html).toContain("min-w-0");
  });
});

describe("DashboardMetricsGrid with charts", () => {
  const card = (id: string, value: number) => ({ metric: DASHBOARD_METRICS.find((m) => m.id === id)!, value });

  it("should put the chart of a group under the count cards of that group, and keep the cards", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardMetricsGrid, {
        results: [card("seats_available", 39), card("bookings_pending", 2)],
        charts: [resultOf("seats_by_status", SEATS)],
      }),
    );

    expect(html).toContain("Available seats");
    expect(html).toContain(">39<");
    expect(html.indexOf("Available seats")).toBeLessThan(html.indexOf("Seats by status"));
    expect(html.indexOf("Seats by status")).toBeLessThan(html.indexOf("Pending bookings"));
  });

  it("should show no chart for a group that has none, and still show its cards", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardMetricsGrid, { results: [card("bookings_pending", 2)], charts: [] }),
    );

    expect(html).toContain("Pending bookings");
    expect(html).not.toContain("by status");
  });
});
