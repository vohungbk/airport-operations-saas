import type { KpiTile } from "@/features/kpi/lib/kpi-tile";
import { NOT_AVAILABLE_TEXT } from "@/lib/kpi/kpi-figures";

/**
 * The frame of the Estimated business value of the ROI dashboard, as the design draws it (VI-F05-S04, R5,
 * R10, R13). No baseline can be saved yet and no estimate formula exists (spec Q2, other stories), so every
 * estimated value says Not available and is marked Estimate. A value is never made up, and an estimate is
 * never added to the verified results. Pure, no I/O.
 */

const NO_BASELINE_CAPTION = "Estimate · No baseline saved yet";

export const ESTIMATE_INTRO =
  "All values below are modelled from the saved baseline. They are not verified cash savings or recognised revenue.";

const NOT_AVAILABLE_ESTIMATE = `${NOT_AVAILABLE_TEXT} · Estimate`;

/** The three estimated cards of the summary row. */
export function buildEstimateCards(period_label: string): KpiTile[] {
  return [
    { id: "estimated_avoided_costs", label: "Estimated avoided costs", value: NOT_AVAILABLE_TEXT, caption: NO_BASELINE_CAPTION },
    { id: "estimated_conversion_value", label: "Estimated conversion value", value: NOT_AVAILABLE_TEXT, caption: NO_BASELINE_CAPTION },
    { id: "total_partner_value_created", label: "Total partner value created", value: NOT_AVAILABLE_TEXT, caption: `Estimate · ${period_label}` },
  ];
}

export interface EstimateLine {
  id: string;
  label: string;
  value: string;
}

/** The estimated lines above the table. */
export const ESTIMATE_LINES: readonly EstimateLine[] = [
  { id: "avoided_handling", label: "Estimate · Avoided handling", value: NOT_AVAILABLE_ESTIMATE },
  { id: "inventory_savings", label: "Estimate · Inventory savings", value: NOT_AVAILABLE_ESTIMATE },
  { id: "conversion_value", label: "Estimate · Conversion value", value: NOT_AVAILABLE_ESTIMATE },
];

export const BREAKDOWN_HEADINGS = ["Cost category", "Baseline", "Programme scenario", "Estimated value"] as const;

export interface BreakdownRow {
  category: string;
  baseline: string;
  scenario: string;
  estimated: string;
}

const breakdownRow = (category: string): BreakdownRow => ({
  category,
  baseline: NOT_AVAILABLE_ESTIMATE,
  scenario: NOT_AVAILABLE_ESTIMATE,
  estimated: NOT_AVAILABLE_ESTIMATE,
});

/** The breakdown table: every cell is Not available · Estimate until a baseline model exists. */
export const BREAKDOWN_ROWS: readonly BreakdownRow[] = ["Staff handling", "Owned inventory", "Customer conversion"].map(breakdownRow);

export const TREND_HEADING = "Value breakdown and trend · Estimate";
export const TREND_EMPTY = "Estimate monthly total: Not available until a baseline is saved";
