import { formatChange, type KpiChange } from "@/lib/assistant/answer";
import { abbreviateNumber, classifyChartData, formatFullNumber, type ChartPoint, type ChartStatus } from "@/lib/charts/chart-data";

/**
 * Pure logic for the KPI tile and the sparkline (UI-F05-S04, spec R4, R9, R10). The tile only shows
 * the numbers it is given; this words them, and decides which state to show.
 */

export type KpiTileState = "loading" | "error" | "forbidden" | "empty" | "ready";

/**
 * What the tile shows. A tile that is loading, failed or not allowed never shows the numbers it was
 * given. A figure that could not be read is `empty`: it is not shown as 0 (a real 0 is `ready`).
 */
export function kpiTileState(status: ChartStatus, current: number | null): KpiTileState {
  if (status !== "ready") return status;
  return current !== null && Number.isFinite(current) ? "ready" : "empty";
}

export interface KpiComparison {
  /** Shortened for the tile (`1.3M`); `current_full` is the number as it is, for the title and the screen reader. */
  current_short: string;
  current_full: string;
  previous_full: string | null;
  change: KpiChange;
}

export function kpiComparison(current: number, previous: number | null): KpiComparison {
  return {
    current_short: abbreviateNumber(current),
    current_full: formatFullNumber(current),
    previous_full: previous !== null && Number.isFinite(previous) ? formatFullNumber(previous) : null,
    change: formatChange(current, previous),
  };
}

const CHANGE_WORD = { up: "Up", down: "Down", flat: "No change", unknown: "No comparison" } as const;

/** "Up 25.0%", "Down 8.0%", "No change", "No comparison": the change in words, so an arrow is never alone (R12). */
export function changeWords({ direction, text }: KpiChange): string {
  return direction === "up" || direction === "down" ? `${CHANGE_WORD[direction]} ${text.replace(/^[+-]/, "")}` : CHANGE_WORD[direction];
}

export interface KpiPeriodLabels {
  current: string;
  previous: string;
}

export const DEFAULT_PERIOD_LABELS: KpiPeriodLabels = { current: "This month", previous: "Last month" };

/** "Revenue: This month 1,250; Last month 1,000; Up 25.0%": the whole tile as one sentence. */
export function describeKpi(label: string, current: number, previous: number | null, labels: KpiPeriodLabels = DEFAULT_PERIOD_LABELS): string {
  const { current_full, previous_full, change } = kpiComparison(current, previous);
  return `${label}: ${labels.current} ${current_full}; ${labels.previous} ${previous_full ?? "no data"}; ${changeWords(change)}`;
}

const isKnown = (point: ChartPoint) => point.value !== null && Number.isFinite(point.value);

/** A trend needs two values to be a direction, and values that are not all 0 (spec R10). */
export function sparklineReady(points: readonly ChartPoint[]): boolean {
  return points.filter(isKnown).length >= 2 && classifyChartData([{ name: "trend", points }]) !== "empty";
}

/** The index of the last point that has a value, where the sparkline puts its end mark; -1 for none. */
export function lastKnownIndex(points: readonly ChartPoint[]): number {
  for (let i = points.length - 1; i >= 0; i -= 1) if (isKnown(points[i])) return i;
  return -1;
}

/** "Revenue trend: Jan 120, Feb 135": every point by label and full value, for the label of the sparkline. */
export function describeSparkline(label: string, points: readonly ChartPoint[]): string {
  const parts = points.map((p) => `${p.label} ${p.value === null ? "no data" : formatFullNumber(p.value)}`);
  return `${label} trend: ${parts.join(", ")}`;
}
