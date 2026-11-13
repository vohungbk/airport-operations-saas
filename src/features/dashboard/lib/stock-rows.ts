import { meterProgress } from "@/lib/money/money";
import { seriesColor, seriesSymbol } from "@/lib/charts/chart-tokens";

/** The seats of one category: those available now, and all of its seats. */
export interface StockCategory {
  label: string;
  available: number;
  total: number;
}

export interface StockRow {
  label: string;
  /** The symbol before the name, so a row is told apart by more than its color. */
  symbol: string;
  /** The chart token of the bar. */
  color: string;
  count: number;
  /** How much of the category's seats are available, 0 to 100. */
  percent: number;
}

/** One row for each category, in the order given, with the symbol and color of its place. */
export function toStockRows(categories: readonly StockCategory[]): StockRow[] {
  return categories.map((category, index) => ({
    label: category.label,
    symbol: seriesSymbol(index),
    color: seriesColor(index),
    count: category.available,
    percent: meterProgress(category.available, category.total).percent ?? 0,
  }));
}
