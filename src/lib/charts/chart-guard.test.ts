import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { findRawColorLines } from "@/lib/accessibility/raw-colors";
import { listSourceFiles } from "@/lib/accessibility/source-files";
import {
  findChartLibraryImports,
  findChartsOutsideFrame,
  findChartsWithoutAccessibilityLayer,
  findMultiSeriesWithoutMarks,
  findUntokenedPaint,
} from "@/lib/charts/chart-guard";

const SRC = join(process.cwd(), "src");
const CHARTS_DIR = join(SRC, "components", "charts");
const read = (file: string) => readFileSync(file, "utf8");

const allFiles = listSourceFiles(SRC);
const chartFiles = listSourceFiles(CHARTS_DIR);
const outsideCharts = allFiles.filter((file) => !file.startsWith(CHARTS_DIR));

describe("chart library (R6)", () => {
  it("should find the chart parts, so the checks below are not empty", () => {
    expect(chartFiles.map((f) => relative(CHARTS_DIR, f))).toEqual(expect.arrayContaining(["chart-container.tsx", "chart-frame.tsx"]));
  });

  it("should let only the chart components import the chart library", () => {
    const offenders = outsideCharts.flatMap((file) => findChartLibraryImports(read(file)).map((m) => `${relative(SRC, file)}: ${m}`));

    expect(offenders).toEqual([]);
  });

  it("should still import the library in the chart container, so the guard is not looking at nothing", () => {
    expect(findChartLibraryImports(read(join(CHARTS_DIR, "chart-container.tsx")))).toEqual(["recharts"]);
  });
});

describe("chart colors (R8)", () => {
  it("should write no raw color in the chart parts", () => {
    const offenders = chartFiles.flatMap((file) => findRawColorLines(read(file)).map((line) => `${relative(SRC, file)}:${line}`));

    expect(offenders).toEqual([]);
  });

  it("should paint marks only with a chart token", () => {
    const offenders = chartFiles.flatMap((file) => findUntokenedPaint(read(file)).map((attr) => `${relative(SRC, file)}: ${attr}`));

    expect(offenders).toEqual([]);
  });
});

describe("findChartLibraryImports", () => {
  it.each([
    ["recharts", 'import { BarChart } from "recharts";'],
    ["a d3 module", 'import { scaleLinear } from "d3-scale";'],
    ["chart.js", 'import Chart from "chart.js";'],
    ["a visx module", 'import { Bar } from "@visx/shape";'],
  ])("should find %s", (_name, code) => {
    expect(findChartLibraryImports(code)).toHaveLength(1);
  });

  it("should accept our own chart components and other libraries", () => {
    const code = 'import { ChartFrame } from "@/components/charts/chart-frame"; import { Card } from "@/components/ui/card"; import { ChartIcon } from "lucide-react";';
    expect(findChartLibraryImports(code)).toEqual([]);
  });
});

describe("findUntokenedPaint", () => {
  it.each([
    ["a plain word", '<Bar fill="red" />'],
    ["a color of another token", '<Bar fill="var(--primary)" />'],
    ["a chart token that does not exist", '<Line stroke="var(--chart-7)" />'],
    ["a color in an expression", "<Line stroke={'blue'} />"],
  ])("should find %s", (_name, code) => {
    expect(findUntokenedPaint(`export const A = () => ${code};`)).toHaveLength(1);
  });

  it.each([
    ["a chart token", '<Bar fill="var(--chart-1)" />'],
    ["the grid token", '<CartesianGrid stroke="var(--chart-grid)" />'],
    ["currentColor", '<path stroke="currentColor" />'],
    ["a pattern", '<Bar fill="url(#pattern-1)" />'],
    ["a color computed from the series", "<Bar fill={seriesColor(i)} />"],
  ])("should accept %s", (_name, code) => {
    expect(findUntokenedPaint(`export const A = () => ${code};`)).toEqual([]);
  });
});

/**
 * Charts that are allowed to be drawn without a frame and without `accessibilityLayer`, with the reason.
 * The sparkline sits inside a KPI tile that carries the numbers as text; it is drawn only when it has a
 * trend (`sparklineReady`) and it is named for a screen reader. Keep this list short.
 */
const EXEMPT_FROM_FRAME = new Map([["sparkline.tsx", "a small trend line in a KPI tile, which holds the numbers as text"]]);

const frameCandidates = chartFiles.filter((file) => !EXEMPT_FROM_FRAME.has(relative(CHARTS_DIR, file)));

describe("honest charts (UI-F05-S05, R7, R10, E5)", () => {
  it("should draw every chart in a frame, so no chart skips the empty, gap, error and permission states", () => {
    const offenders = frameCandidates.flatMap((file) => findChartsOutsideFrame(read(file)).map((tag) => `${relative(SRC, file)}: ${tag}`));

    expect(offenders).toEqual([]);
  });

  it("should turn on accessibilityLayer for every chart, so a keyboard user can reach its values", () => {
    const offenders = frameCandidates.flatMap((file) => findChartsWithoutAccessibilityLayer(read(file)).map((tag) => `${relative(SRC, file)}: ${tag}`));

    expect(offenders).toEqual([]);
  });

  it("should tell the series of a chart apart by a pattern or a marker, not by color alone", () => {
    const offenders = chartFiles.flatMap((file) => findMultiSeriesWithoutMarks(read(file)).map((hit) => `${relative(SRC, file)}: ${hit}`));

    expect(offenders).toEqual([]);
  });

  it("should find the chart files with a chart in them, so the checks above are not empty", () => {
    const inAFrame = frameCandidates.filter((file) => read(file).includes("<ChartFrame"));
    expect(inAFrame.map((f) => relative(CHARTS_DIR, f)).sort()).toEqual([
      "donut-chart.tsx",
      "horizontal-bar-chart.tsx",
      "line-chart.tsx",
      "stacked-bar-chart.tsx",
    ]);
  });

  it.each([...EXEMPT_FROM_FRAME.keys()])("should keep %s exempt only while it still draws without a frame and holds back an empty trend", (name) => {
    const source = read(join(CHARTS_DIR, name));
    expect(findChartsOutsideFrame(source).length).toBeGreaterThan(0);
    expect(source).toContain("sparklineReady");
  });
});

describe("findChartsOutsideFrame", () => {
  it("should find a chart with no frame", () => {
    expect(findChartsOutsideFrame("export const A = () => <BarChart data={d}><Bar dataKey='v' /></BarChart>;")).toEqual(["<BarChart>"]);
  });

  it("should accept a chart inside a frame", () => {
    expect(findChartsOutsideFrame("export const A = () => <ChartFrame title='t'><BarChart accessibilityLayer /></ChartFrame>;")).toEqual([]);
  });

  it("should not look at a file with no chart", () => {
    expect(findChartsOutsideFrame("export const A = () => <div />;")).toEqual([]);
  });
});

describe("findChartsWithoutAccessibilityLayer", () => {
  it("should find a chart that does not turn it on", () => {
    expect(findChartsWithoutAccessibilityLayer("export const A = () => <LineChart data={d} />;")).toEqual(["<LineChart>"]);
  });

  it("should accept a chart that turns it on", () => {
    expect(findChartsWithoutAccessibilityLayer("export const A = () => <PieChart accessibilityLayer />;")).toEqual([]);
  });

  it("should check each chart of a file", () => {
    expect(findChartsWithoutAccessibilityLayer("export const A = () => <><BarChart accessibilityLayer /><LineChart /></>;")).toEqual(["<LineChart>"]);
  });
});

describe("findMultiSeriesWithoutMarks", () => {
  it("should find stacked bars whose frame lists them by color", () => {
    const code = "export const A = () => <ChartFrame title='t'><BarChart><Bar stackId='s' /></BarChart></ChartFrame>;";
    expect(findMultiSeriesWithoutMarks(code)).toHaveLength(1);
  });

  it("should find lines whose frame says color", () => {
    const code = "export const A = () => <ChartFrame legend_style='color'><LineChart><Line /></LineChart></ChartFrame>;";
    expect(findMultiSeriesWithoutMarks(code)).toHaveLength(1);
  });

  it("should accept a pattern for stacked bars and a marker for lines", () => {
    expect(findMultiSeriesWithoutMarks("export const A = () => <ChartFrame legend_style='pattern'><Bar stackId='s' /></ChartFrame>;")).toEqual([]);
    expect(findMultiSeriesWithoutMarks("export const A = () => <ChartFrame legend_style='marker'><Line /></ChartFrame>;")).toEqual([]);
  });

  it("should accept a computed legend style, as a computed paint is not read", () => {
    const code = "export const A = () => <ChartFrame legend_style={solid ? 'symbol' : 'pattern'}><Bar stackId='s' /></ChartFrame>;";
    expect(findMultiSeriesWithoutMarks(code)).toEqual([]);
  });

  it("should accept a symbol for stacked bars", () => {
    expect(findMultiSeriesWithoutMarks("export const A = () => <ChartFrame legend_style='symbol'><Bar stackId='s' /></ChartFrame>;")).toEqual([]);
  });

  it("should not ask a chart of one series for marks", () => {
    expect(findMultiSeriesWithoutMarks("export const A = () => <ChartFrame><BarChart><Bar dataKey='v' /></BarChart></ChartFrame>;")).toEqual([]);
  });
});
