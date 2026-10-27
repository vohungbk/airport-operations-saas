import { formatFullNumber, type ChartPoint, type ChartSeries } from "@/lib/charts/chart-data";

/**
 * Pure logic for the bar charts (UI-F05-S02, spec R1, E1, E2). The charts only draw what they are
 * given; this words the labels, sizes the chart for its categories and writes the same numbers as
 * text, so a screen reader and the tests can read what a drawing shows.
 */

/** Room for one bar, and for each extra line of its wrapped label. */
export const BAR_ROW_HEIGHT = 32;
export const LABEL_LINE_HEIGHT = 14;
const CHART_PADDING = 16;
export const MIN_CHART_HEIGHT = 120;
/** The chart body scrolls inside its box past this height (24 rem, the `max-h-96` class). */
export const SCROLL_AFTER_HEIGHT = 384;

export const LABEL_MAX_CHARS = 18;
const MIN_LABEL_WIDTH = 80;
const MAX_LABEL_WIDTH = 160;
const CHAR_WIDTH = 7;

/**
 * Splits a label into lines of at most `maxChars`, at spaces. A word longer than a line is cut, so
 * no text is lost (E2).
 */
export function wrapLabel(label: string, maxChars = LABEL_MAX_CHARS): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let line = "";
  const push = (text: string) => {
    if (text) lines.push(text);
  };

  for (const word of words) {
    let rest = word;
    while (rest.length > maxChars) {
      push(line);
      line = "";
      lines.push(rest.slice(0, maxChars));
      rest = rest.slice(maxChars);
    }
    if (line === "") line = rest;
    else if (line.length + 1 + rest.length <= maxChars) line = `${line} ${rest}`;
    else {
      push(line);
      line = rest;
    }
  }
  push(line);
  return lines;
}

export function maxLabelLines(labels: readonly string[], maxChars = LABEL_MAX_CHARS): number {
  return Math.max(1, ...labels.map((label) => wrapLabel(label, maxChars).length));
}

/** The drawing height for a number of categories. It grows with them and with their wrapped labels. */
export function barChartHeight(count: number, maxLines = 1): number {
  if (!Number.isFinite(count) || count <= 0) return MIN_CHART_HEIGHT;
  const row = BAR_ROW_HEIGHT + (Math.max(1, maxLines) - 1) * LABEL_LINE_HEIGHT;
  return Math.max(MIN_CHART_HEIGHT, Math.round(count * row + CHART_PADDING));
}

export function needsScroll(height: number): boolean {
  return height > SCROLL_AFTER_HEIGHT;
}

/** The width of the column of labels: the longest line, kept between a floor and a ceiling. */
export function labelColumnWidth(labels: readonly string[], maxChars = LABEL_MAX_CHARS): number {
  const longest = Math.max(0, ...labels.flatMap((label) => wrapLabel(label, maxChars).map((line) => line.length)));
  return Math.min(MAX_LABEL_WIDTH, Math.max(MIN_LABEL_WIDTH, longest * CHAR_WIDTH + 12));
}

export interface BarItem {
  label: string;
  /** `null` is a gap: the value could not be read. */
  value: number | null;
}

export const toBarSeries = (items: readonly BarItem[], name: string): ChartSeries[] => [
  { name, points: items satisfies readonly ChartPoint[] },
];

/** "Available 12, Reserved 3": every bar by name and value, for the label of the chart. */
export function describeBars(title: string, items: readonly BarItem[]): string {
  const parts = items.map((item) => `${item.label} ${item.value === null ? "no data" : formatFullNumber(item.value)}`);
  return `${title}: ${parts.join(", ")}`;
}

/** One row per category for a stacked bar, with a key for each segment (`s0`, `s1`, ...). */
export type StackRow = { label: string; total: number } & Record<string, string | number | null>;

export const segmentKey = (index: number) => `s${index}`;

export function toStackRows(series: readonly ChartSeries[]): StackRow[] {
  const labels = [...new Set(series.flatMap((s) => s.points.map((p) => p.label)))];
  return labels.map((label) => {
    const row: StackRow = { label, total: 0 };
    series.forEach((s, index) => {
      const value = s.points.find((p) => p.label === label)?.value ?? null;
      row[segmentKey(index)] = value;
      row.total += value !== null && Number.isFinite(value) ? value : 0;
    });
    return row;
  });
}

/** "Open: Low 2, High 1 (total 3)": every category with its segments, for the label of the chart. */
export function describeStacks(title: string, series: readonly ChartSeries[]): string {
  const parts = toStackRows(series).map((row) => {
    const segments = series.map((s, index) => `${s.name} ${formatFullNumber(row[segmentKey(index)] as number | null)}`);
    return `${row.label}: ${segments.join(", ")} (total ${formatFullNumber(row.total)})`;
  });
  return `${title}: ${parts.join("; ")}`;
}
