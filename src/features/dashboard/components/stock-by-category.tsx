import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import type { BarItem } from "@/lib/charts/bar-data";

interface StockByCategoryProps {
  /** `null` when the counts could not be read. */
  items: readonly BarItem[] | null;
}

/** The seats of each category. A failed read shows the chart's error with a retry; no seats shows its empty state. */
export function StockByCategory({ items }: StockByCategoryProps) {
  return (
    <HorizontalBarChart
      title="Stock by category"
      status={items === null ? "error" : "ready"}
      items={items ?? []}
      series_name="Seats"
    />
  );
}
