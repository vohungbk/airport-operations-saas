import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { findRawColorLines } from "@/lib/accessibility/raw-colors";
import { listSourceFiles } from "@/lib/accessibility/source-files";
import { findChartLibraryImports, findUntokenedPaint } from "@/lib/charts/chart-guard";

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
