import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { withChartName } from "@/components/charts/chart-container";
import { ChartFrame, type ChartFrameProps } from "@/components/charts/chart-frame";
import { DonutChart } from "@/components/charts/donut-chart";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { KpiComparisonTile } from "@/components/charts/kpi-comparison-tile";
import { LineTrendChart } from "@/components/charts/line-chart";
import { StackedBarChart } from "@/components/charts/stacked-bar-chart";
import type { ChartSeries, ChartStatus } from "@/lib/charts/chart-data";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

type Values = (number | null)[];
const points = (...values: Values) => values.map((value, i) => ({ label: `Label ${i + 1}`, value }));

/** Every kind of chart, drawn from the same list of values, so each rule is checked on all of them. */
const CHARTS: Record<string, (values: Values, status?: ChartStatus) => string> = {
  "horizontal bar": (values, status = "ready") => html(createElement(HorizontalBarChart, { title: "Chart T", status, items: points(...values) })),
  "stacked bar": (values, status = "ready") =>
    html(createElement(StackedBarChart, { title: "Chart T", status, series: [{ name: "Low", points: points(...values) }, { name: "High", points: points(...values) }] })),
  donut: (values, status = "ready") => html(createElement(DonutChart, { title: "Chart T", status, items: points(...values) })),
  line: (values, status = "ready") => html(createElement(LineTrendChart, { title: "Chart T", status, series: [{ name: "Net", points: points(...values) }] })),
};
const NAMES = Object.keys(CHARTS);

describe.each(NAMES)("%s chart", (name) => {
  const draw = CHARTS[name];

  describe("series told apart (AC01, R7)", () => {
    it("should list its series in a text legend", () => {
      expect(draw([5, 3])).toContain('data-slot="chart-legend"');
    });
  });

  describe("missing data (AC02, R10)", () => {
    it("should say there is no data, not draw a chart of zeros", () => {
      const out = draw([0, 0, 0]);
      expect(out).toContain("No data to chart yet.");
      expect(out).not.toContain('role="group"');
    });

    it("should say there is no data when every value is missing", () => {
      expect(draw([null, null])).toContain("No data to chart yet.");
    });

    it("should draw with a note when some data is missing", () => {
      expect(draw([5, null, 3])).toContain('data-slot="chart-gap-note"');
    });
  });

  describe("error (AC05, E4)", () => {
    it("should replace the chart with an error and a retry button, even when the screen gave no handler", () => {
      const out = draw([5, 3], "error");
      expect(out).toContain("This chart could not be loaded.");
      expect(out).toMatch(/<button[^>]*>.*Retry/);
      expect(out).not.toContain('role="group"');
    });
  });

  describe("values for a screen reader and a keyboard (AC06, E5)", () => {
    it("should write every value with its full number in the label of the chart", () => {
      const out = draw([1_250_000, 40]);
      expect(out).toContain("1,250,000");
      expect(out).toContain('role="group"');
      expect(out).toContain("Label 1");
    });
  });

  describe("print (AC07, E6)", () => {
    it("should print the numbers of the chart as a table under it, and not print the switch", () => {
      const out = draw([1_250_000, 40]);
      expect(out).toContain('data-slot="chart-print-table"');
      expect(out).toContain("hidden print:block");
      expect(out).toContain("1,250,000");
      expect(out).toMatch(/<button[^>]*print:hidden[^>]*>[^]*View as table/);
    });
  });

  describe("no leak (spec §2.1)", () => {
    it.each(["loading", "error", "forbidden"] as const)("should not hold the values or labels in the %s state, in the label, the legend or the print table", (status) => {
      const out = CHARTS[name]([987_654, 321], status).replace(/Chart T/g, "");
      expect(out).not.toContain("987,654");
      expect(out).not.toContain("987654");
      expect(out).not.toContain("Label 1");
      expect(out).not.toContain('data-slot="chart-print-table"');
    });
  });
});

describe("the legend marks (AC01, R7)", () => {
  it("should tell stacked segments and donut slices apart by pattern as well as color", () => {
    expect(CHARTS["stacked bar"]([5, 3])).toContain("<pattern");
    expect(CHARTS.donut([5, 3])).toContain("<pattern");
  });

  it("should tell lines apart by a marker as well as color", () => {
    expect(CHARTS.line([5, 3])).toContain("data-marker=");
  });
});

describe("the table view (AC03, AC04, NAV-1)", () => {
  const series: ChartSeries[] = [{ name: "Seats", points: points(1_250_000, 40, null) }];
  const frame = (over: Partial<ChartFrameProps> = {}) =>
    html(createElement(ChartFrame, { title: "Seats by status", status: "ready", series, ...over } as ChartFrameProps, createElement("p", null, "THE-CHART")));

  it("should offer the switch as a button, which a keyboard reaches and presses", () => {
    expect(frame()).toMatch(/<button type="button"[^>]*>[^]*View as table/);
  });

  it("should show a data table with the same numbers when the table view is open", () => {
    const out = frame({ initial_view: "table" });
    expect(out).toContain("<table");
    expect(out).toContain("1,250,000");
    expect(out).toContain(">40<");
    expect(out).not.toContain("THE-CHART");
  });

  it("should show a gap in the table as a dash, not 0", () => {
    expect(frame({ initial_view: "table" })).toContain(">-<");
  });

  it("should offer the way back to the chart", () => {
    expect(frame({ initial_view: "table" })).toContain("View as chart");
  });

  it("should name the table for a screen reader", () => {
    expect(frame({ initial_view: "table" })).toContain("Seats by status: the numbers of the chart");
  });

  it("should open on the chart by default", () => {
    expect(frame()).toContain("THE-CHART");
  });

  it("should not show a table, or the switch, to a person who has no access", () => {
    const out = frame({ status: "forbidden", initial_view: "table" });
    expect(out).not.toContain("<table");
    expect(out).not.toContain("View as table");
    expect(out).not.toContain("View as chart");
  });
});

describe("the name of the drawing (AC06, E5)", () => {
  it("should give the drawing of the library the name a keyboard user lands on", () => {
    const named = withChartName(createElement("div"), "Seats by status");
    expect((named.props as { title?: string }).title).toBe("Seats by status");
  });
});

describe("the KPI tile (AC05)", () => {
  it("should offer retry on an error even when the screen gave no handler", () => {
    const out = html(createElement(KpiComparisonTile, { label: "Revenue", status: "error", current: null, previous: null }));
    expect(out).toMatch(/<button[^>]*>.*Retry/);
  });
});

describe("print theme (AC07, E6)", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

  it("should apply the Dark values outside print only, so a chart prints in the Light theme", () => {
    expect(css).toMatch(/@media not print\s*\{\s*(?:\/\*[\s\S]*?\*\/\s*)?\.dark\s*\{/);
  });

  it("should apply the dark: variant outside print only", () => {
    expect(css).toMatch(/@custom-variant dark\s*\{[^}]*@media not print/);
  });
});
