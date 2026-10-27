/**
 * Pure logic for the chart parts (UI-F05-S01, spec R5, R10, E1, E3). A chart only draws what it is
 * given; this decides whether there is anything to draw, and words the same numbers for the table.
 */

export interface ChartPoint {
  label: string;
  /** `null` is a gap: the value could not be read, which is not the same as 0. */
  value: number | null;
}

export interface ChartSeries {
  name: string;
  points: readonly ChartPoint[];
}

export type ChartDataState = "empty" | "partial" | "ready";

const isNumber = (value: number | null): value is number => value !== null && Number.isFinite(value);

/**
 * `empty` when there is nothing to chart, and a chart whose values are all 0 is empty too: zeros are
 * never shown as live data (R10). `partial` when some points are missing, so the chart gets a note.
 * One value or one series is `ready` (E1).
 */
export function classifyChartData(series: readonly ChartSeries[]): ChartDataState {
  const points = series.flatMap((s) => s.points);
  const known = points.map((p) => p.value).filter(isNumber);
  if (known.length === 0 || known.every((value) => value === 0)) return "empty";
  return known.length < points.length ? "partial" : "ready";
}

export type ChartStatus = "loading" | "ready" | "error" | "forbidden";
export type ChartFrameState = "loading" | "error" | "forbidden" | ChartDataState;

/**
 * What the frame shows. Only a chart that was read (`ready`) is looked at for data; a chart that
 * is loading, failed or not allowed shows that, and never the data it was given (spec §5.1).
 */
export function chartFrameState(status: ChartStatus, series: readonly ChartSeries[]): ChartFrameState {
  return status === "ready" ? classifyChartData(series) : status;
}

const UNITS = [
  { size: 1e3, symbol: "K" },
  { size: 1e6, symbol: "M" },
  { size: 1e9, symbol: "B" },
] as const;

const oneDecimal = (n: number) => Math.round(n * 10) / 10;

/** `1200000` becomes `1.2M`. The table keeps the full number (E3). A value that is not a number is `-`. */
export function abbreviateNumber(value: number): string {
  if (!Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs < UNITS[0].size) return `${sign}${oneDecimal(abs)}`;

  let index = UNITS.length - 1;
  while (index > 0 && abs < UNITS[index].size) index -= 1;
  let shown = oneDecimal(abs / UNITS[index].size);
  // 999 999 would read 1000K; it is 1M.
  if (shown >= 1000 && index < UNITS.length - 1) {
    index += 1;
    shown = oneDecimal(abs / UNITS[index].size);
  }
  return `${sign}${shown}${UNITS[index].symbol}`;
}

const FULL = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** The whole number with thousands separators, for the table. */
export function formatFullNumber(value: number | null): string {
  return isNumber(value) ? FULL.format(value) : "-";
}

export interface ChartTable {
  columns: string[];
  rows: string[][];
}

/**
 * The same numbers as the chart, as a table (R5). Rows follow the order the labels first appear in;
 * a series that has no point for a label, or a gap, shows `-`.
 */
export function toChartTable(series: readonly ChartSeries[], labelHeading = "Name"): ChartTable {
  const labels = [...new Set(series.flatMap((s) => s.points.map((p) => p.label)))];
  return {
    columns: [labelHeading, ...series.map((s) => s.name)],
    rows: labels.map((label) => [
      label,
      ...series.map((s) => formatFullNumber(s.points.find((p) => p.label === label)?.value ?? null)),
    ]),
  };
}
