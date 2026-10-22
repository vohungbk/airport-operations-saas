import type { ChartTone } from "@/features/dashboard/lib/dashboard-charts";
import type { DashboardChartResult } from "@/features/dashboard/lib/get-dashboard-charts";

export interface ChartRow {
  key: string;
  label: string;
  value: number;
  /** Whole percent of the total, for the words beside the bar. */
  percent: number;
  /** Exact share of the total, 0 to 100, for the width of the bar. */
  share: number;
  tone: ChartTone;
  emphasis: boolean;
}

export type ChartView =
  /** A count could not be read: no chart, and no zeros in its place. */
  | { state: "unavailable" }
  /** Every count is zero: nothing to chart. */
  | { state: "empty" }
  | { state: "ready"; total: number; rows: ChartRow[] };

/**
 * Pure. What a chart shows. A count that could not be read makes the whole chart
 * unavailable, since the shares of the others would be wrong without it. A chart of
 * only zeros is an empty state, not a chart presented as live data (spec E6). In a
 * chart that has data, a bar of 0 is a real zero and is shown with its word.
 */
export function summarizeChart({ bars }: DashboardChartResult): ChartView {
  if (bars.some((bar) => bar.value === null)) {
    return { state: "unavailable" };
  }

  const total = bars.reduce((sum, bar) => sum + (bar.value ?? 0), 0);
  if (total === 0) {
    return { state: "empty" };
  }

  return {
    state: "ready",
    total,
    rows: bars.map(({ category, value }) => {
      const count = value ?? 0;
      return {
        key: category.key,
        label: category.label,
        value: count,
        percent: Math.round((count / total) * 100),
        share: (count / total) * 100,
        tone: category.tone,
        emphasis: category.emphasis === true,
      };
    }),
  };
}
