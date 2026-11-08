import type { KpiTile } from "@/features/kpi/lib/kpi-tile";
import type { ReportRow, ReportRowType } from "@/features/kpi/lib/report-csv";
import type { BaselineValues } from "@/features/roi/lib/baseline-inputs";
import { buildBaselineEstimate, type TrendMonthFigures } from "@/features/roi/lib/estimated-value";
import { buildVerifiedResults, isEmptyRoiPeriod } from "@/features/roi/lib/verified-results";
import type { AdditionalKpis } from "@/lib/kpi/get-additional-kpis";
import type { CoreKpis } from "@/lib/kpi/get-core-kpis";
import { filterBySearch } from "@/lib/kpi/kpi-search";

export const SUMMARY_SECTION = "Summary";
export const VERIFIED_SECTION = "Verified results";
export const ESTIMATE_SECTION = "Estimated business value";

const VERIFIED_SUMMARY_ID = "verified_partner_revenue";

const card = (tile: KpiTile): ReportRow => {
  const type: ReportRowType = tile.id === VERIFIED_SUMMARY_ID ? "Verified" : "Estimate";

  return { section: SUMMARY_SECTION, type, figure: tile.label, value: tile.value, detail: tile.caption };
};

export interface RoiReportInput {
  core: CoreKpis;
  additional: AdditionalKpis;
  baseline?: BaselineValues | null;
  period_label: string;
  months: number;
  trend_months: TrendMonthFigures[];
  query: string;
}

/**
 * Pure (VI-F05-T03, AC02, AC03). The ROI dashboard as report rows. They come from the builders the screen uses,
 * with the same search, so the values equal the screen. The verified results are marked Verified, every
 * estimated value is marked Estimate, and a figure that cannot be worked out says Not available.
 */
export function buildRoiReportRows({ core, additional, baseline, period_label, months, trend_months, query }: RoiReportInput): {
  rows: ReportRow[];
  is_empty: boolean;
} {
  const verified = buildVerifiedResults(core, additional);
  const estimate = buildBaselineEstimate(baseline, core, { period_label, months, verified_revenue_text: verified.summary.value, trend_months });

  const estimated = (figure: string, value: string, detail = ""): ReportRow => ({
    section: ESTIMATE_SECTION,
    type: "Estimate",
    figure,
    value,
    detail,
  });

  const rows: ReportRow[] = [
    ...filterBySearch([verified.summary, ...estimate.cards], query).map(card),
    ...filterBySearch(verified.rows, query).map((row): ReportRow => ({
      section: VERIFIED_SECTION,
      type: "Verified",
      figure: row.label,
      value: row.value,
      detail: "",
    })),
    ...estimate.lines.map((line) => estimated(line.label, line.value)),
    ...estimate.breakdown.map((row) =>
      estimated(row.category, row.estimated, `Baseline: ${row.baseline} · Programme scenario: ${row.scenario}`),
    ),
    estimated("Estimate monthly total", estimate.trend.summary),
  ];

  return { rows, is_empty: isEmptyRoiPeriod(core) };
}
