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
