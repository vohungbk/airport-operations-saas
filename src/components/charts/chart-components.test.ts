import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Bar, BarChart } from "recharts";
import { describe, expect, it } from "vitest";

import { ChartContainer, chartContainerVariants, type ChartContainerProps } from "@/components/charts/chart-container";
import { ChartDataTable } from "@/components/charts/chart-data-table";
import { ChartFrame, type ChartFrameProps } from "@/components/charts/chart-frame";
import type { ChartSeries } from "@/lib/charts/chart-data";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

const series = (...values: (number | null)[]): ChartSeries[] => [
  { name: "Open", points: values.map((value, i) => ({ label: `L${i + 1}`, value })) },
];

const frame = (over: Partial<ChartFrameProps> = {}) =>
  html(
    createElement(
      ChartFrame,
      { title: "Seats by status", status: "ready", series: series(3, 5), ...over } as ChartFrameProps,
      createElement("p", null, "THE-CHART"),
    ),
  );

describe("ChartFrame", () => {
  it("should show the title, the chart and a text legend", () => {
    const out = frame();
    expect(out).toContain("Seats by status");
    expect(out).toContain("THE-CHART");
    expect(out).toContain('data-slot="chart-legend"');
    expect(out).toContain("Open");
  });

  it("should offer to view the same numbers as a table", () => {
    expect(frame()).toContain("View as table");
  });

  it("should give the legend color from a chart token", () => {
    expect(frame()).toContain("--swatch:var(--chart-1)");
  });

  it("should show a skeleton and say it is loading", () => {
    const out = frame({ status: "loading" });
    expect(out).toContain('data-slot="chart-loading"');
    expect(out).toContain("Loading the chart");
    expect(out).toContain('aria-busy="true"');
    expect(out).not.toContain("THE-CHART");
  });

  it("should show an error with a retry button in place of the chart", () => {
    const out = frame({ status: "error" });
    expect(out).toContain("This chart could not be loaded.");
    expect(out).toContain("Retry");
    expect(out).toContain("<svg");
    expect(out).not.toContain("THE-CHART");
  });

  it("should not show the data when the person has no access", () => {
    const out = frame({ status: "forbidden" });
    expect(out).toContain("You do not have access to this chart.");
    expect(out).not.toContain("THE-CHART");
    expect(out).not.toContain('data-slot="chart-legend"');
  });

  it("should say there is no data, not draw a chart of zeros", () => {
    const out = frame({ series: series(0, 0, 0) });
    expect(out).toContain("No data to chart yet.");
    expect(out).not.toContain("THE-CHART");
    expect(out).not.toContain("View as table");
  });

  it("should say there is no data for no series", () => {
    expect(frame({ series: [] })).toContain("No data to chart yet.");
  });

  it("should draw the chart with a note when some data is missing", () => {
    const out = frame({ series: series(3, null, 8) });
    expect(out).toContain("THE-CHART");
    expect(out).toContain('data-slot="chart-gap-note"');
    expect(out).toContain("Some data is missing");
  });

  it("should use the note it is given for a gap", () => {
    expect(frame({ series: series(3, null), gap_note: "Two airports have not reported." })).toContain("Two airports have not reported.");
  });

  it("should draw one value or one series without an error (E1)", () => {
    const out = frame({ series: series(4) });
    expect(out).toContain("THE-CHART");
    expect(out).not.toContain('data-slot="chart-error"');
  });

  it("should keep a long title inside the card", () => {
    expect(frame({ title: "A very long title ".repeat(10) })).toContain("break-words");
  });
});

describe("ChartDataTable", () => {
  const table = { columns: ["Name", "Open"], rows: [["L1", "1,200,000"], ["L2", "-"]] };
  const render = () => html(createElement(ChartDataTable, { table, caption: "Seats by status: the numbers of the chart" }));

  it("should show the full numbers of the chart", () => {
    const out = render();
    expect(out).toContain("1,200,000");
    expect(out).toContain("Seats by status: the numbers of the chart");
  });

  it("should show a gap as a dash and align the numbers right with tabular figures", () => {
    const out = render();
    expect(out).toContain(">-<");
    expect(out).toContain("text-right tabular-nums");
  });

  it("should scroll inside its own box, not the page", () => {
    expect(render()).toContain("overflow-x-auto");
  });
});

describe("ChartContainer", () => {
  const container = (props: object = {}) =>
    html(
      createElement(
        ChartContainer,
        { label: "Seats by status", ...props } as ChartContainerProps,
        createElement(BarChart, { data: [{ name: "A", v: 2 }] }, createElement(Bar, { dataKey: "v" })),
      ),
    );

  it("should take the width of its parent and set none of its own (R11)", () => {
    const out = container();
    expect(out).toContain("w-full min-w-0 overflow-hidden");
    expect(out).toContain('width:100%');
  });

  it("should name the chart for a screen reader", () => {
    const out = container();
    expect(out).toContain('role="group"');
    expect(out).toContain('aria-label="Seats by status"');
  });

  it("should hold the chart in the library's responsive container", () => {
    expect(container()).toContain("recharts-responsive-container");
  });

  it.each([
    ["sm", "h-40"],
    ["md", "h-60"],
    ["lg", "h-80"],
  ] as const)("should give the %s size a height of %s and no fixed width", (size, height) => {
    const classes = chartContainerVariants({ size });
    expect(classes).toContain(height);
    expect(classes).not.toMatch(/(^|\s)w-\[?\d/);
  });
});
