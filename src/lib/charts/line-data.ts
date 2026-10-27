import { formatFullNumber, type ChartSeries } from "@/lib/charts/chart-data";

/**
 * Pure logic for the line chart (UI-F05-S03, spec R3, E1, E3). The chart only draws what it is
 * given; this decides which points carry a label and words the same numbers as text.
 */

/** Up to this many points every point carries its value. */
const LABEL_ALL_UP_TO = 8;
const LABEL_MAX_PER_LINE = 8;

/**
 * Every how many points a value is written. Labels of twelve months written at full width run into
 * each other on a phone, so past eight points only every second (or third...) point has one; the
 * tooltip and the table have them all.
 */
export function pointLabelStep(count: number): number {
  if (!Number.isFinite(count) || count <= LABEL_ALL_UP_TO) return 1;
  return Math.ceil(count / LABEL_MAX_PER_LINE);
}

export function labelsPoint(index: number, count: number): boolean {
  return index % pointLabelStep(count) === 0;
}

/**
 * Whether the points carry their values. Two lines that run close write over each other and over
 * the lines, so only a chart of one line writes them; the tooltip and the table have the rest.
 */
export const writesPointValues = (seriesCount: number): boolean => seriesCount === 1;

/** "Revenue: Jan 120, Feb 135": every point by label and full value, for the label of the chart. */
export function describeLines(title: string, series: readonly ChartSeries[]): string {
  const parts = series.map((s) => {
    const points = s.points.map((p) => `${p.label} ${p.value === null ? "no data" : formatFullNumber(p.value)}`);
    return `${s.name}: ${points.join(", ")}`;
  });
  return `${title}: ${parts.join("; ")}`;
}
