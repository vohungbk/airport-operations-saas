import ts from "typescript";

import { moduleSpecifiers } from "@/lib/components/component-guard";

/**
 * UI-F05-S01 (spec R6, R8): checks on the source of the chart parts. Test support only; nothing in
 * the app imports it. They read text, so they are a floor.
 */

/** The chart libraries a screen must not import: one is used, and only through `src/components/charts`. */
const CHART_LIBRARY =
  /^(recharts|d3(-[\w-]+)?|victory(-[\w-]+)?|chart\.js|react-chartjs-2|@visx\/[\w-]+|@nivo\/[\w-]+|echarts|apexcharts|react-apexcharts)(\/|$)/;

export function findChartLibraryImports(source: string): string[] {
  return moduleSpecifiers(source).filter((specifier) => CHART_LIBRARY.test(specifier));
}

/** What a mark may be painted with: a chart token, or a value that adds no color of its own. */
const TOKEN_PAINT = /^(var\(--chart-([1-6]|grid)\)|currentColor|none|transparent|inherit|url\(#[\w-]+\))$/;
const PAINT_ATTRIBUTES = new Set(["fill", "stroke", "color", "stopColor"]);

/**
 * `fill`, `stroke`, `color` and `stopColor` written as a string that is not one of the six chart
 * tokens or the grid token (R8). A value that is computed (`fill={seriesColor(i)}`) is not read.
 */
export function findUntokenedPaint(source: string): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && PAINT_ATTRIBUTES.has(node.name.getText()) && node.initializer) {
      const init = node.initializer;
      const literal = ts.isStringLiteral(init)
        ? init.text
        : ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)
          ? init.expression.text
          : null;
      if (literal !== null && !TOKEN_PAINT.test(literal)) found.push(node.getText());
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile("x.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));
  return found;
}

/**
 * UI-F05-S05 (spec R7, R10, E5): checks that keep a chart honest and reachable. A chart element of the
 * library must sit in a `ChartFrame` (so a chart of zeros, a gap, a loading, an error and a missing
 * permission are handled in one place), must turn on `accessibilityLayer` (so a keyboard user can focus
 * it and move between its values), and a chart of several series must tell them apart by more than color.
 */
const CHART_ELEMENTS = new Set([
  "BarChart",
  "LineChart",
  "PieChart",
  "AreaChart",
  "RadarChart",
  "ScatterChart",
  "ComposedChart",
  "RadialBarChart",
  "FunnelChart",
  "Treemap",
  "Sankey",
]);

interface ChartUse {
  /** The chart elements of the library the file draws, with whether each turns on `accessibilityLayer`. */
  charts: { tag: string; accessible: boolean }[];
  frames: ts.JsxOpeningLikeElement[];
  /** Elements that mean several series or slices: a stack, a pie, a line. */
  multiSeries: boolean;
}

function readChartUse(source: string): ChartUse {
  const use: ChartUse = { charts: [], frames: [], multiSeries: false };
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText();
      const has = (name: string) => node.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText() === name);
      if (CHART_ELEMENTS.has(tag)) use.charts.push({ tag, accessible: has("accessibilityLayer") });
      if (tag === "ChartFrame") use.frames.push(node);
      if (tag === "Pie" || tag === "Line" || has("stackId")) use.multiSeries = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile("x.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));
  return use;
}

/** A chart of the library drawn outside a `ChartFrame`: it would skip the empty, gap, error and permission states. */
export function findChartsOutsideFrame(source: string): string[] {
  const { charts, frames } = readChartUse(source);
  return frames.length === 0 ? charts.map((chart) => `<${chart.tag}>`) : [];
}

/** A chart that does not turn on `accessibilityLayer`: a keyboard user cannot reach its values (E5). */
export function findChartsWithoutAccessibilityLayer(source: string): string[] {
  return readChartUse(source)
    .charts.filter((chart) => !chart.accessible)
    .map((chart) => `<${chart.tag}>`);
}

/** A chart of several series whose frame lists them by color alone: neighbouring series need a pattern or a marker (R7). */
export function findMultiSeriesWithoutMarks(source: string): string[] {
  const { frames, multiSeries } = readChartUse(source);
  if (!multiSeries) return [];
  return frames
    .filter((frame) => {
      const style = frame.attributes.properties.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === "legend_style");
      const value = style?.initializer && ts.isStringLiteral(style.initializer) ? style.initializer.text : "color";
      return value === "color";
    })
    .map(() => "<ChartFrame> without legend_style");
}
