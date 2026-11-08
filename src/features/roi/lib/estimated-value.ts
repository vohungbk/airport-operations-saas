import type { KpiTile } from "@/features/kpi/lib/kpi-tile";
import type { BaselineValues } from "@/features/roi/lib/baseline-inputs";
import { calculateEstimate, type Estimate } from "@/features/roi/lib/estimate";
import { completedRentals, usdLabel } from "@/features/roi/lib/verified-results";
import type { ChartPoint } from "@/lib/charts/chart-data";
import type { CoreKpis } from "@/lib/kpi/get-core-kpis";
import { NOT_AVAILABLE_TEXT } from "@/lib/kpi/kpi-figures";

/**
 * Words the Estimated business value of the ROI dashboard as the design draws it (VI-F05-S06, R5, R10, R13):
 * three cards, three lines, the breakdown table and the value bars. Every estimated value says Estimate, and
 * an estimate is never worded as a verified figure. A value that cannot be worked out says Not available, never
 * 0. Pure, no I/O.
 */

export const ESTIMATE_INTRO =
  "All values below are modelled from the saved baseline. They are not verified cash savings or recognised revenue.";

export const BREAKDOWN_HEADINGS = ["Cost category", "Baseline", "Programme scenario", "Estimated value"] as const;

export const TREND_HEADING = "Value breakdown and trend · Estimate";

/** `USD 1,200`, `− USD 800` for a negative estimate, and Not available when there is no figure. */
export function estimateAmount(amount: number | null): string {
  if (amount === null) return NOT_AVAILABLE_TEXT;

  return amount < 0 ? `− ${usdLabel(-amount)}` : usdLabel(amount);
}

/** `30 incremental rentals`, `1 incremental rental`, `−1.3 incremental rentals`: one decimal at most, and the same minus as the amounts. */
function incrementalRentalsText(count: number): string {
  const rounded = Math.round(count * 10) / 10;

  return `${rounded < 0 ? "−" : ""}${Math.abs(rounded)} incremental rental${Math.abs(rounded) === 1 ? "" : "s"}`;
}

/** `USD 1,200 · Estimate`: the value with the mark that says it is an estimate. */
const marked = (amount: number | null): string => `${estimateAmount(amount)} · Estimate`;

export interface EstimateLine {
  id: string;
  label: string;
  value: string;
}

export interface BreakdownRow {
  category: string;
  baseline: string;
  scenario: string;
  estimated: string;
}

export interface EstimateSeries {
  id: string;
  label: string;
  /** How long the bar is, from 0 to 100, against the longest one. */
  share: number;
  tone: "primary" | "secondary";
}

/** One month of the trend with what the dashboard read for it; `core` is `null` when that month could not be read. */
export interface TrendMonthFigures {
  label: string;
  core: CoreKpis | null;
}

export interface TotalTrend {
  /** One point for each month, oldest first; `null` is a month with no total. */
  points: ChartPoint[];
  /** `Estimate monthly total: May USD 6,800 · Jun Not available`. */
  summary: string;
}

export interface EstimateView {
  cards: KpiTile[];
  lines: EstimateLine[];
  breakdown: BreakdownRow[];
  series: EstimateSeries[];
  trend: TotalTrend;
}

const BREAKDOWN_CATEGORY = {
  staff_handling: "Staff handling",
  owned_inventory: "Owned inventory",
  customer_conversion: "Customer conversion",
} as const;

export interface BaselineEstimateContext {
  period_label: string;
  /** The months the period covers (see `monthsInPeriod`). */
  months: number;
  /** The verified partner revenue as it is worded on the card, so the bar names the verified figure beside the estimates. */
  verified_revenue_text: string;
  /** The months of the trend, oldest first (VI-F05-S07). Empty when no trend is read. */
  trend_months?: TrendMonthFigures[];
}

const LINE_TONES: EstimateSeries["tone"][] = ["secondary", "primary", "secondary"];

const NO_BASELINE_CAPTION = "Estimate · No baseline saved yet";

const BREAKDOWN_IDS = ["staff_handling", "owned_inventory", "customer_conversion"] as const;

function seriesOf(entries: (Omit<EstimateSeries, "share"> & { value: number })[]): EstimateSeries[] {
  const longest = Math.max(0, ...entries.map((entry) => entry.value));

  return entries.map(({ value, ...series }) => ({
    ...series,
    share: longest > 0 ? Math.round((Math.max(0, value) / longest) * 1000) / 10 : 0,
  }));
}

interface EstimateViewContext extends Omit<BaselineEstimateContext, "months" | "trend_months"> {
  trend: TotalTrend;
  /** The verified partner revenue as a number; `null` when it is not available. */
  verified_revenue: number | null;
}

/**
 * The view of the estimate. Without an estimate (no baseline is saved, E2) every estimated value says Not
 * available and is marked Estimate, so the frame of the design stays whole and nothing is made up (R13).
 */
/**
 * The monthly total of the trend (VI-F05-S07, AC01, AC02): for each month the verified revenue of that month plus
 * its estimated lines, worked out with the same formula as the total of the period and one month. A month with no
 * baseline, no read, no completed rentals or no verified revenue has no total and says Not available, never 0 (R13).
 */
export function buildTotalTrend(baseline: BaselineValues | null | undefined, months: TrendMonthFigures[]): TotalTrend {
  const totals = months.map(({ core }) => {
    const rentals = core && completedRentals(core);

    if (!baseline || !core || rentals === null) return null;

    const verified_revenue = core.commercial.state === "value" ? core.commercial.amount : null;

    return calculateEstimate(baseline, { rentals, months: 1, verified_revenue }).total_partner_value;
  });

  return {
    points: months.map(({ label }, index) => ({ label, value: totals[index] })),
    summary: `Estimate monthly total: ${months.map(({ label }, index) => `${label} ${estimateAmount(totals[index])}`).join(" · ")}`,
  };
}

function buildEstimateView(estimate: Estimate | null, context: EstimateViewContext): EstimateView {
  const lineFigures = [estimate?.avoided_handling ?? null, estimate?.inventory_savings ?? null, estimate?.conversion_value ?? null];
  const lines: EstimateLine[] = [
    { id: "avoided_handling", label: "Estimate · Avoided handling", value: marked(lineFigures[0]) },
    { id: "inventory_savings", label: "Estimate · Inventory savings", value: marked(lineFigures[1]) },
    { id: "conversion_value", label: "Estimate · Conversion value", value: marked(lineFigures[2]) },
  ];

  return {
    cards: [
      {
        id: "estimated_avoided_costs",
        label: "Estimated avoided costs",
        value: estimateAmount(estimate?.avoided_costs ?? null),
        caption: estimate ? "Estimate · Baseline model" : NO_BASELINE_CAPTION,
      },
      {
        id: "estimated_conversion_value",
        label: "Estimated conversion value",
        value: estimateAmount(lineFigures[2]),
        caption: estimate ? `Estimate · ${incrementalRentalsText(estimate.incremental_rentals)}` : NO_BASELINE_CAPTION,
      },
      {
        id: "total_partner_value_created",
        label: "Total partner value created",
        value: estimateAmount(estimate?.total_partner_value ?? null),
        caption: `Estimate · ${context.period_label}`,
      },
    ],
    lines,
    breakdown: BREAKDOWN_IDS.map((id) => {
      const row = estimate?.breakdown.find((candidate) => candidate.id === id);

      return {
        category: BREAKDOWN_CATEGORY[id],
        baseline: marked(row?.baseline ?? null),
        scenario: marked(row?.scenario ?? null),
        estimated: marked(row?.estimated ?? null),
      };
    }),
    series: seriesOf([
      {
        id: "verified_partner_revenue",
        label: `Verified partner revenue · ${context.verified_revenue_text}`,
        value: context.verified_revenue ?? 0,
        tone: "primary",
      },
      ...lines.map((line, index) => ({ id: line.id, label: `${line.label} · ${line.value}`, value: lineFigures[index] ?? 0, tone: LINE_TONES[index] })),
    ]),
    trend: context.trend,
  };
}

/**
 * The Estimated business value of a period (E2). With a baseline and the completed rentals of the period it is
 * worked out; without a baseline (or on the internal dashboard, which has none) the frame is kept and every
 * estimated value says Not available.
 */
export function buildBaselineEstimate(
  baseline: BaselineValues | null | undefined,
  core: CoreKpis,
  { months, trend_months = [], ...context }: BaselineEstimateContext,
): EstimateView {
  const rentals = completedRentals(core);
  const verified_revenue = core.commercial.state === "value" ? core.commercial.amount : null;
  const estimate = baseline && rentals !== null ? calculateEstimate(baseline, { rentals, months, verified_revenue }) : null;

  return buildEstimateView(estimate, { ...context, verified_revenue, trend: buildTotalTrend(baseline, trend_months) });
}
