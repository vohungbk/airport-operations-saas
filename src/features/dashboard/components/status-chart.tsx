import { DonutChart } from "@/components/charts/donut-chart";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { StackedBarChart } from "@/components/charts/stacked-bar-chart";
import type { DashboardChartResult } from "@/features/dashboard/lib/get-dashboard-charts";

interface StatusChartProps {
  result: DashboardChartResult;
  /** How the counts are drawn: a ring, a bar for each status, or one bar cut into its statuses. */
  variant: "donut" | "bars" | "stacked";
}

/**
 * The groups of the seat ring in the design, in its order: each takes the statuses it counts. A status in
 * none of them (a retired seat) is not in the ring, as the design's total counts the seats in stock.
 */
const SEAT_RING: readonly { label: string; statuses: readonly string[] }[] = [
  { label: "Available", statuses: ["available"] },
  { label: "Active rental", statuses: ["in_use"] },
  { label: "Reserved", statuses: ["reserved"] },
  { label: "Cleaning / inspection", statuses: ["cleaning", "inspection"] },
  { label: "Quarantine", statuses: ["quarantine"] },
];

/**
 * One group of counts drawn with the chart components (UI-F06-S05, spec R7). The frame of the component
 * says what a chart that could not be read (with a retry) or that has nothing to count shows: neither is
 * drawn as a chart of zeros.
 */
export function StatusChart({ result, variant }: StatusChartProps) {
  const status = result.bars.some((bar) => bar.value === null)
    ? "error"
    : "ready";
  const { title } = result.chart;

  if (variant === "donut") {
    const ring = SEAT_RING.map(({ label, statuses }) => ({
      label,
      value: result.bars
        .filter(({ category }) => statuses.includes(category.key))
        .reduce((sum, bar) => sum + (bar.value ?? 0), 0),
    }));

    return (
      <DonutChart
        title={title}
        status={status}
        items={ring}
        series_name="Seats"
        solid
      />
    );
  }

  const items = result.bars.map(({ category, value }) => ({
    label: category.label,
    value,
  }));

  if (variant === "stacked") {
    // The design lists the severities from the lightest to the heaviest.
    const series = [...items].reverse().map((item) => ({
      name: item.label,
      points: [{ label: "Open incidents", value: item.value }],
    }));

    return <StackedBarChart title={title} status={status} series={series} solid />;
  }

  return (
    <HorizontalBarChart
      title={title}
      status={status}
      items={items}
      series_name="Count"
    />
  );
}
