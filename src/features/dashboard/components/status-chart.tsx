import {
  BarsCard,
  DonutCard,
  SegmentsCard,
  type ChartCardRow,
} from "@/features/dashboard/components/chart-cards";
import { DashboardChart } from "@/features/dashboard/components/dashboard-chart";
import { summarizeChart } from "@/features/dashboard/lib/dashboard-chart-data";
import type { DashboardChartResult } from "@/features/dashboard/lib/get-dashboard-charts";

interface StatusChartProps {
  result: DashboardChartResult;
  /** How the counts are drawn: a ring, a bar for each status, or one bar cut into its statuses. */
  variant: "donut" | "bars" | "stacked";
}

/** The color and symbol of each severity in the design; Critical has none of its own, so it takes the one of High. */
const SEVERITY_STYLE: Record<string, Pick<ChartCardRow, "color" | "symbol">> = {
  low: { color: 5, symbol: "○" },
  medium: { color: 2, symbol: "▲" },
  high: { color: 4, symbol: "✚" },
  critical: { color: 4, symbol: "" },
};

/**
 * The groups of the seat ring in the design, in its order: each takes the statuses it counts. A status in
 * none of them (a retired seat) is not in the ring, as the design's total counts the seats in stock.
 */
const SEAT_RING: readonly {
  label: string;
  statuses: readonly string[];
  color: number;
  symbol: string;
}[] = [
  { label: "Available", statuses: ["available"], color: 3, symbol: "●" },
  { label: "Active rental", statuses: ["in_use"], color: 0, symbol: "◆" },
  { label: "Reserved", statuses: ["reserved"], color: 1, symbol: "■" },
  {
    label: "Cleaning / inspection",
    statuses: ["cleaning", "inspection"],
    color: 2,
    symbol: "▲",
  },
  { label: "Quarantine", statuses: ["quarantine"], color: 4, symbol: "✚" },
];

function formatToday(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One group of counts drawn as the design draws it (UI-F06-S04): solid colors, with the symbol in the label.
 * A group that could not be read, or that has nothing to count, keeps the card that says so
 * (`DashboardChart`): neither is drawn as a chart of zeros.
 */
export function StatusChart({ result, variant }: StatusChartProps) {
  const view = summarizeChart(result);

  if (view.state !== "ready") {
    return <DashboardChart result={result} />;
  }

  const { title } = result.chart;
  const rows: ChartCardRow[] = view.rows.map((row) => ({
    label: row.label,
    value: row.value,
  }));

  if (variant === "donut") {
    const ring = SEAT_RING.map(({ label, statuses, color, symbol }) => ({
      label,
      color,
      symbol,
      value: view.rows
        .filter((row) => statuses.includes(row.key))
        .reduce((sum, row) => sum + row.value, 0),
    }));

    return <DonutCard title={title} rows={ring} unit="seats" />;
  }

  if (variant === "stacked") {
    // The design lists the severities from the lightest to the heaviest.
    const bySeverity = [...view.rows].reverse().map((row) => ({
      label: row.label,
      value: row.value,
      ...SEVERITY_STYLE[row.key],
    }));

    return (
      <SegmentsCard title={title} rows={bySeverity} noun="open incidents" />
    );
  }

  return (
    <BarsCard
      title={title}
      rows={rows}
      legend={`Legend: symbol + status label · count · ${formatToday()}`}
    />
  );
}
