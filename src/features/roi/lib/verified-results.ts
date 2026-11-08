import { plural } from "@/features/kpi/lib/additional-kpi-tiles";
import { NO_COMPLETED_RENTALS_CAPTION, usd } from "@/features/kpi/lib/core-kpi-tiles";
import type { KpiTile } from "@/features/kpi/lib/kpi-tile";
import type { AdditionalKpis } from "@/lib/kpi/get-additional-kpis";
import type { CoreKpis } from "@/lib/kpi/get-core-kpis";
import { NOT_AVAILABLE_TEXT, NO_DATA_TEXT } from "@/lib/kpi/kpi-figures";

/**
 * Words the verified results of the ROI dashboard (VI-F05-S04, R4, R9, R13). Every value is a KPI figure
 * of the KPI dashboard, so both screens show the same value for the same scope and period (E6). A figure
 * with nothing to count says No data, one with nothing stored says Not available: neither is a 0.
 * Pure, no I/O.
 */

export const VERIFIED_RESULTS_NOTE =
  "These values are reconciled from completed booking records, approved revenue ledger and verified refund events.";

/** `USD 6,000` or `USD 1,250.50`: the amount of `usd` as the ROI design writes it, so both screens round alike. */
export const usdLabel = (amount: number): string => `USD ${usd(amount).replace("$", "")}`;

export interface VerifiedRow {
  id: "verified_partner_revenue" | "verified_refunds" | "verified_completed_rentals";
  label: string;
  value: string;
}

export interface VerifiedResults {
  /** The first card of the summary row. */
  summary: KpiTile;
  /** The rows of the Verified results card. */
  rows: VerifiedRow[];
}

/** The completed rentals of the period; `null` when there is none, so no figure is made up. */
export function completedRentals(core: CoreKpis): number | null {
  return core.incidents.state === "value" ? core.incidents.completed_bookings : null;
}

function revenueValue(core: CoreKpis): string {
  const { commercial } = core;

  if (commercial.state === "value") return usdLabel(commercial.amount);

  return commercial.state === "no_data" ? NO_DATA_TEXT : NOT_AVAILABLE_TEXT;
}

function revenueCaption(core: CoreKpis): string {
  const { commercial } = core;

  if (commercial.state === "not_available") return commercial.reason;

  const rentals = completedRentals(core);

  return rentals === null ? NO_COMPLETED_RENTALS_CAPTION : plural(rentals, "completed rental");
}

/** A refund is taken off the revenue, so it is written with a minus; no refund is a plain 0. */
function refundsValue(additional: AdditionalKpis): string {
  const { refunds } = additional;

  if (refunds.state === "no_data") return NO_DATA_TEXT;

  return refunds.amount === 0 ? usdLabel(0) : `− ${usdLabel(refunds.amount)}`;
}

export function buildVerifiedResults(core: CoreKpis, additional: AdditionalKpis): VerifiedResults {
  const rentals = completedRentals(core);

  return {
    summary: {
      id: "verified_partner_revenue",
      label: "Verified partner revenue",
      value: revenueValue(core),
      caption: revenueCaption(core),
    },
    rows: [
      { id: "verified_partner_revenue", label: "Verified partner revenue", value: revenueValue(core) },
      { id: "verified_refunds", label: "Verified refunds", value: refundsValue(additional) },
      { id: "verified_completed_rentals", label: "Verified completed rentals", value: rentals === null ? NO_DATA_TEXT : String(rentals) },
    ],
  };
}

/** The period has nothing to show: no rental is completed (E1). */
export function isEmptyRoiPeriod(core: CoreKpis): boolean {
  return completedRentals(core) === null && core.commercial.state === "no_data";
}
