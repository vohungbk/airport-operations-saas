import { buildAdditionalKpiTiles } from "@/features/kpi/lib/additional-kpi-tiles";
import { buildCoreKpiTiles, isEmptyPeriod } from "@/features/kpi/lib/core-kpi-tiles";
import type { KpiTile } from "@/features/kpi/lib/kpi-tile";
import type { ReportRow } from "@/features/kpi/lib/report-csv";
import type { AdditionalKpis } from "@/lib/kpi/get-additional-kpis";
import type { CoreKpis } from "@/lib/kpi/get-core-kpis";
import { filterBySearch } from "@/lib/kpi/kpi-search";

export const CORE_SECTION = "Core programme KPIs";
export const ADDITIONAL_SECTION = "Additional operational KPIs";

const toRows = (section: string, tiles: readonly KpiTile[]): ReportRow[] =>
  tiles.map((tile) => ({ section, type: "Verified", figure: tile.label, value: tile.value, detail: tile.caption }));

export interface KpiReportInput {
  kpis: CoreKpis;
  additional: AdditionalKpis;
  /** The period before, for the change lines; `null` when the comparison is off or could not be read. */
  previous: CoreKpis | null;
  period_label: string;
  query: string;
}

/**
 * Pure (VI-F05-T03, AC02). The tiles of the KPI dashboard as report rows. They are the tiles the screen builds,
 * narrowed by the same search, so every value and every line under it equals the screen. Every KPI figure is
 * verified.
 */
export function buildKpiReportRows({ kpis, additional, previous, period_label, query }: KpiReportInput): {
  rows: ReportRow[];
  is_empty: boolean;
} {
  const core = filterBySearch(buildCoreKpiTiles(kpis, previous), query);
  const extra = filterBySearch(buildAdditionalKpiTiles(additional, kpis.commercial, period_label), query);

  return { rows: [...toRows(CORE_SECTION, core), ...toRows(ADDITIONAL_SECTION, extra)], is_empty: isEmptyPeriod(kpis) };
}
