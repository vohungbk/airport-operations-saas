import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { KpiComparisonTile, type KpiComparisonTileProps } from "@/components/charts/kpi-comparison-tile";
import { Sparkline } from "@/components/charts/sparkline";
import { MetricTile } from "@/features/dashboard/components/metric-tile";
import { DASHBOARD_METRICS } from "@/features/dashboard/lib/dashboard-metrics";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

const tile = (over: Partial<KpiComparisonTileProps> = {}) =>
  html(createElement(KpiComparisonTile, { label: "Revenue", status: "ready", current: 120, previous: 100, ...over }));

const trend = (...values: (number | null)[]) => values.map((value, i) => ({ label: `M${i + 1}`, value }));

describe("KpiComparisonTile", () => {
  it("should show the label, the period, the figure and the period before", () => {
    const out = tile();
    expect(out).toContain("Revenue");
    expect(out).toContain("This month");
    expect(out).toContain('data-slot="kpi-figure"');
    expect(out).toContain("Last month 100");
  });

  it("should show a rise with an arrow and words", () => {
    const out = tile();
    expect(out).toContain('data-direction="up"');
    expect(out).toContain("Up 20.0%");
    expect(out).toContain("<svg");
  });

  it("should show a fall with words", () => {
    const out = tile({ current: 92 });
    expect(out).toContain('data-direction="down"');
    expect(out).toContain("Down 8.0%");
  });

  it("should say there is no change when the figures are equal", () => {
    expect(tile({ current: 100 })).toContain("No change");
  });

  it("should say there is no comparison, not Infinity, when the period before was 0", () => {
    const out = tile({ current: 8, previous: 0 });
    expect(out).toContain("No comparison");
    expect(out).not.toContain("Infinity");
    expect(out).not.toContain("NaN");
  });

  it("should say there is no data for a missing period before", () => {
    expect(tile({ previous: null })).toContain("Last month no data");
  });

  it("should use the period names it is given", () => {
    const out = tile({ period_labels: { current: "May", previous: "April" } });
    expect(out).toContain("May");
    expect(out).toContain("April 100");
  });

  it("should shorten a very large figure and keep the whole number in the title and for a screen reader (E3)", () => {
    const out = tile({ current: 1_250_000, previous: 1_000_000 });
    expect(out).toContain(">1.3M<");
    expect(out).toContain('title="1,250,000"');
    expect(out).toContain('<span class="sr-only">1,250,000</span>');
  });

  it("should show a real 0 as 0, as a count card does", () => {
    const out = tile({ current: 0, previous: 5 });
    expect(out).toContain('data-state="ready"');
    expect(out).toContain(">0<");
  });

  it("should say there is no data, not 0, when the figure could not be read", () => {
    const out = tile({ current: null });
    expect(out).toContain('data-state="empty"');
    expect(out).toContain("No data yet.");
    expect(out).not.toContain('data-slot="kpi-figure"');
  });

  it("should show a loading state without the figure", () => {
    const out = tile({ status: "loading" });
    expect(out).toContain('data-slot="kpi-loading"');
    expect(out).toContain('aria-busy="true"');
    expect(out).not.toContain('data-slot="kpi-figure"');
  });

  it("should show an error with a retry button, without the figure", () => {
    const out = tile({ status: "error" });
    expect(out).toContain("This figure could not be loaded.");
    expect(out).toContain("Retry");
    expect(out).not.toContain('data-slot="kpi-figure"');
  });

  it("should not show the figure to a person who has no access", () => {
    const out = tile({ status: "forbidden" });
    expect(out).toContain("You do not have access to this figure.");
    expect(out).not.toContain("120");
  });

  it("should draw the trend line when it has values", () => {
    const out = tile({ trend: trend(100, 110, 120) });
    expect(out).toContain('aria-label="Revenue trend: M1 100, M2 110, M3 120"');
  });

  it("should draw no trend line for one value, or for none", () => {
    expect(tile({ trend: trend(100) })).not.toContain("trend:");
    expect(tile({ trend: [] })).not.toContain("trend:");
    expect(tile()).not.toContain('role="img"');
  });
});

describe("same numbers as the count card it replaces (spec R9)", () => {
  const metric = DASHBOARD_METRICS[0];
  const countOf = (out: string) => /(\d+)<\/p>/.exec(out)![1];
  const tileFullNumber = (out: string) => /<span class="sr-only">([\d,]+)<\/span>/.exec(out)![1].replace(/,/g, "");

  it.each([0, 7, 137, 12_500, 1_250_000])("should show %s as the count card does", (count) => {
    const card = html(createElement(MetricTile, { metric, value: count }));
    expect(tileFullNumber(tile({ current: count }))).toBe(countOf(card));
  });
});

describe("Sparkline", () => {
  const spark = (points: ReturnType<typeof trend>) => html(createElement(Sparkline, { label: "Revenue", points }));

  it("should name every point with its full value for a screen reader", () => {
    expect(spark(trend(1_250_000, 90))).toContain('aria-label="Revenue trend: M1 1,250,000, M2 90"');
  });

  it("should be small", () => {
    expect(spark(trend(1, 2))).toContain("h-10");
  });

  it("should say no data for a gap, and still draw", () => {
    expect(spark(trend(3, null, 5))).toContain("M2 no data");
  });

  it.each([
    ["no points", trend()],
    ["one point", trend(4)],
    ["only zeros", trend(0, 0, 0)],
    ["one known value", trend(null, 4, null)],
  ])("should draw nothing for %s", (_name, points) => {
    expect(spark(points)).toBe("");
  });
});
