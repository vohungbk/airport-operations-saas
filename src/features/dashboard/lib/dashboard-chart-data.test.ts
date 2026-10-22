import { describe, expect, it } from "vitest";

import { summarizeChart } from "@/features/dashboard/lib/dashboard-chart-data";
import { DASHBOARD_CHARTS } from "@/features/dashboard/lib/dashboard-charts";
import type { DashboardChartResult } from "@/features/dashboard/lib/get-dashboard-charts";

const chart = DASHBOARD_CHARTS.find((c) => c.id === "open_incidents_by_severity")!;

/** The counts in the order of the bars: critical, high, medium, low. */
const result = (values: (number | null)[]): DashboardChartResult => ({
  chart,
  bars: chart.categories.map((category, i) => ({ category, value: values[i] })),
});

describe("summarizeChart (spec VI-F01 E6, R7)", () => {
  it("should give each bar its label, its count and its share of the total", () => {
    const view = summarizeChart(result([1, 1, 2, 0]));

    expect(view).toMatchObject({ state: "ready", total: 4 });
    if (view.state !== "ready") return;
    expect(view.rows.map((r) => [r.label, r.value, r.percent, r.share])).toEqual([
      ["Critical", 1, 25, 25],
      ["High", 1, 25, 25],
      ["Medium", 2, 50, 50],
      ["Low", 0, 0, 0],
    ]);
  });

  it("should keep a bar of 0 as a real zero when the chart has data", () => {
    const view = summarizeChart(result([0, 0, 5, 0]));

    expect(view.state).toBe("ready");
    if (view.state === "ready") expect(view.rows.filter((r) => r.value === 0)).toHaveLength(3);
  });

  it("should say empty, and give no bars, when every count was read and is zero", () => {
    expect(summarizeChart(result([0, 0, 0, 0]))).toEqual({ state: "empty" });
  });

  it("should say unavailable, and no zeros, when any count could not be read", () => {
    expect(summarizeChart(result([3, null, 2, 1]))).toEqual({ state: "unavailable" });
    expect(summarizeChart(result([null, null, null, null]))).toEqual({ state: "unavailable" });
  });

  it("should not divide by zero, and never go over 100 percent in the width of a bar", () => {
    const view = summarizeChart(result([7, 0, 0, 0]));

    expect(view.state).toBe("ready");
    if (view.state !== "ready") return;
    expect(view.rows[0]).toMatchObject({ percent: 100, share: 100 });
    expect(view.rows.every((r) => r.share >= 0 && r.share <= 100)).toBe(true);
  });

  it("should mark only Critical as the bar to stand out", () => {
    const view = summarizeChart(result([1, 1, 1, 1]));

    expect(view.state === "ready" && view.rows.filter((r) => r.emphasis).map((r) => r.key)).toEqual(["critical"]);
  });
});
