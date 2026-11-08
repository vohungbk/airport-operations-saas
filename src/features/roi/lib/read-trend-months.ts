import type { TrendMonthFigures } from "@/features/roi/lib/estimated-value";
import { getCoreKpis } from "@/lib/kpi/get-core-kpis";
import { trendMonths, type ResolvedKpiPeriod } from "@/lib/kpi/kpi-period";

/**
 * The months of the trend (VI-F05-S07), read for the signed-in user like every figure of the page. A month that
 * cannot be read has no figures, so its total says Not available instead of failing the whole dashboard. The
 * ROI dashboard and the ROI report both read them here, so the two show the same totals.
 */
export async function readTrendMonths(period: ResolvedKpiPeriod): Promise<TrendMonthFigures[]> {
  return Promise.all(
    trendMonths(period).map(async ({ label, from, to }) => {
      const result = await getCoreKpis({ from, to });

      return { label, core: result.ok ? result.kpis : null };
    }),
  );
}
