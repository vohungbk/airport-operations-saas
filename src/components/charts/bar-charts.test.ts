import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChartContainer } from "@/components/charts/chart-container";
import { ChartPatternDefs, SeriesSwatch, patternFill, patternId } from "@/components/charts/chart-patterns";
import { HorizontalBarChart, type HorizontalBarChartProps } from "@/components/charts/horizontal-bar-chart";
import { StackedBarChart, type StackedBarChartProps } from "@/components/charts/stacked-bar-chart";
import { WrappedTick } from "@/components/charts/wrapped-tick";
import type { ChartSeries } from "@/lib/charts/chart-data";
import { seriesColor } from "@/lib/charts/chart-tokens";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

const bars = (over: Partial<HorizontalBarChartProps> = {}) =>
  html(
    createElement(HorizontalBarChart, {
      title: "Seats by status",
      status: "ready",
      items: [
        { label: "Available", value: 12 },
        { label: "Reserved", value: 3 },
      ],
      ...over,
    }),
  );

const stacks = (over: Partial<StackedBarChartProps> = {}) =>
  html(
    createElement(StackedBarChart, {
      title: "Incidents by severity",
      status: "ready",
      series: [
        { name: "Low", points: [{ label: "Open", value: 2 }, { label: "Closed", value: 5 }] },
        { name: "High", points: [{ label: "Open", value: 1 }, { label: "Closed", value: 0 }] },
      ],
      ...over,
    }),
  );

const manyItems = (count: number) => Array.from({ length: count }, (_, i) => ({ label: `Category ${i + 1}`, value: i + 1 }));

describe("HorizontalBarChart", () => {
  it("should name every bar with its value for a screen reader", () => {
    const out = bars();
    expect(out).toContain('role="img"');
    expect(out).toContain('aria-label="Seats by status: Available 12, Reserved 3"');
  });

  it("should show the title, a text legend and a switch to the table", () => {
    const out = bars({ series_name: "Seats" });
    expect(out).toContain("Seats by status");
    expect(out).toContain('data-slot="chart-legend"');
    expect(out).toContain("View as table");
  });

  it("should draw one bar without an error (E1)", () => {
    const out = bars({ items: [{ label: "Available", value: 4 }] });
    expect(out).toContain('data-state="ready"');
    expect(out).toContain('aria-label="Seats by status: Available 4"');
    expect(out).not.toContain('data-slot="chart-error"');
  });

  it("should keep the whole name of a long category, not cut it (E2)", () => {
    const label = "Awaiting technician assignment at the terminal";
    expect(bars({ items: [{ label, value: 2 }] })).toContain(label);
  });

  it("should grow with many categories and scroll inside its own box (E2)", () => {
    const out = bars({ items: manyItems(30) });
    expect(out).toContain("max-h-96 overflow-y-auto");
    expect(out).toMatch(/--chart-height:\d{3,}px/);
  });

  it("should not scroll a chart with a few categories", () => {
    expect(bars()).not.toContain("overflow-y-auto");
  });

  it("should give the full number to the screen reader when the bar shows 1.3M", () => {
    expect(bars({ items: [{ label: "Revenue", value: 1_250_000 }] })).toContain("Revenue 1,250,000");
  });

  it("should say there is no data, not draw bars of zeros", () => {
    const out = bars({ items: [{ label: "Available", value: 0 }, { label: "Reserved", value: 0 }] });
    expect(out).toContain("No data to chart yet.");
    expect(out).not.toContain('role="img"');
  });

  it("should draw with a note when a value is missing", () => {
    const out = bars({ items: [{ label: "Available", value: 5 }, { label: "Reserved", value: null }] });
    expect(out).toContain('data-slot="chart-gap-note"');
    expect(out).toContain("Reserved no data");
  });

  it("should not show the data to a person who has no access", () => {
    const out = bars({ status: "forbidden" });
    expect(out).toContain("You do not have access to this chart.");
    expect(out).not.toContain("Available");
  });

  it("should show an error with a retry button", () => {
    expect(bars({ status: "error" })).toContain("Retry");
  });
});

describe("StackedBarChart", () => {
  it("should name every category with its segments and total for a screen reader", () => {
    expect(stacks()).toContain('aria-label="Incidents by severity: Open: Low 2, High 1 (total 3); Closed: Low 5, High 0 (total 5)"');
  });

  it("should list every segment in the legend", () => {
    const out = stacks();
    expect(out).toContain("Low");
    expect(out).toContain("High");
    expect(out).toContain('data-slot="chart-legend"');
  });

  it("should show the pattern of each segment in the legend, as well as its color (R7)", () => {
    expect(stacks()).toContain("<pattern");
    expect(bars()).not.toContain("<pattern");
  });

  it("should draw one series with one category (E1)", () => {
    const out = stacks({ series: [{ name: "Low", points: [{ label: "Open", value: 7 }] }] });
    expect(out).toContain('data-state="ready"');
    expect(out).toContain("Open: Low 7 (total 7)");
  });

  it("should scroll inside its own box with many categories (E2)", () => {
    const points = manyItems(30);
    expect(stacks({ series: [{ name: "Low", points }] })).toContain("max-h-96 overflow-y-auto");
  });

  it("should say there is no data when every segment is 0", () => {
    const series: ChartSeries[] = [{ name: "Low", points: [{ label: "Open", value: 0 }] }];
    expect(stacks({ series })).toContain("No data to chart yet.");
  });

  it("should show a loading state without the data", () => {
    const out = stacks({ status: "loading" });
    expect(out).toContain('data-slot="chart-loading"');
    expect(out).not.toContain("Open:");
  });
});

describe("ChartContainer height", () => {
  const container = (props: object) =>
    html(createElement(ChartContainer, { label: "x", ...props } as never, createElement("div")));

  it("should take a height in pixels through a custom property, with no width of its own", () => {
    const out = container({ height: 416 });
    expect(out).toContain("--chart-height:416px");
    expect(out).toContain("h-(--chart-height)");
    expect(out).toContain("w-full min-w-0");
  });

  it("should keep a size when no height is given", () => {
    const out = container({ size: "sm" });
    expect(out).toContain("h-40");
    expect(out).not.toContain("--chart-height");
  });
});

describe("WrappedTick", () => {
  const tick = (value: string, extra: object = {}) =>
    html(createElement("svg", null, createElement(WrappedTick, { x: 100, y: 20, payload: { value }, ...extra })));

  it("should keep a short name on one line", () => {
    expect(tick("Available").match(/<tspan/g)).toHaveLength(1);
  });

  it("should wrap a long name onto lines and keep all its words", () => {
    const out = tick("Awaiting technician assignment");
    expect(out.match(/<tspan/g)!.length).toBeGreaterThan(1);
    for (const word of ["Awaiting", "technician", "assignment"]) expect(out).toContain(word);
  });

  it("should draw one empty line for a missing name", () => {
    expect(html(createElement("svg", null, createElement(WrappedTick, { x: 0, y: 0 })))).toContain("<tspan");
  });
});

describe("chart patterns", () => {
  it("should leave the first series solid in its own color and pattern the next", () => {
    expect(patternFill("c1", 0)).toBe(seriesColor(0));
    expect(patternFill("c1", 1)).toBe("url(#c1-1)");
  });

  it("should define a pattern for each series after the first, filled with the series color", () => {
    const out = html(createElement("svg", null, createElement(ChartPatternDefs, { id: "c1", count: 3 })));
    expect(out).not.toContain('id="c1-0"');
    expect(out).toContain('id="c1-1"');
    expect(out).toContain('id="c1-2"');
    expect(out).toContain(`fill="${seriesColor(1)}"`);
  });

  it("should draw the swatch of a legend with the pattern of its series, and a solid one in plain color", () => {
    const patterned = html(createElement(SeriesSwatch, { id: "c1", index: 2 }));
    expect(patterned).toContain('id="c1-2"');
    expect(patterned).toContain('fill="url(#c1-2)"');
    const solid = html(createElement(SeriesSwatch, { id: "c1", index: 0 }));
    expect(solid).not.toContain("<pattern");
    expect(solid).toContain(`fill="${seriesColor(0)}"`);
  });

  it("should make an id a url can hold", () => {
    expect(patternId(":r1a:")).toBe("r1a");
  });
});
