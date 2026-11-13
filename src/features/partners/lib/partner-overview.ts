import { currentMonthParam } from "@/lib/kpi/kpi-period";
import { formatKpiFigure, NO_DATA_TEXT, type KpiFigure } from "@/lib/kpi/kpi-figures";
import type { CoreKpis } from "@/lib/kpi/get-core-kpis";
import { meterProgress } from "@/lib/money/money";
import {
  formatInvoiceTotal,
  formatMonth,
  formatTileAmount,
  summarizeOpenInvoices,
  type PartnerFinanceData,
} from "@/features/partners/lib/partner-finance";

/** Where an operations figure opens (NAV-2): the partner has no booking list of its own, so it opens the KPI screen; the finance figures open Finance. */
export const PARTNER_KPI_HREF = "/partner/kpi";

const NONE = "—";
const NO_COMPLETED_CAPTION = "No completed rentals yet";

/** What the database gave for the overview. A `null` is a read that failed or has nothing to count: it shows a dash. */
export interface PartnerOverviewInputs {
  rentals_today: number | null;
  rentals_yesterday: number | null;
  active_rentals: number | null;
  upcoming_reservations: number | null;
  family_ready: number | null;
  awaiting_installation: number | null;
  resolved_incidents: number | null;
  core: CoreKpis | null;
  finance: PartnerFinanceData | null;
}

export interface PartnerOverviewTile {
  label: string;
  value: string;
  caption?: string;
  href: string;
}

export interface PartnerOverviewRevenueRow {
  label: string;
  value: string;
}

export interface PartnerOverviewLaunchCredit {
  /** `USD 6,000 / 10,000` */
  amount: string;
  /** `50 / 50 current share` */
  share: string;
  /** 0 to 100, for the bar. */
  percent: number;
  /** `60%`, the true share, which can pass 100. */
  progress: string;
  /** What is left and what the share becomes; `null` once the launch is over. */
  note: string | null;
}

export interface PartnerOverviewView {
  tiles: PartnerOverviewTile[];
  revenue: PartnerOverviewRevenueRow[];
  /** `null` when the partner has no launch target to measure against. */
  launch_credit: PartnerOverviewLaunchCredit | null;
}

const count = (value: number | null): string => (value === null ? NONE : String(value));

function rentalsTodayCaption(today: number | null, yesterday: number | null): string | undefined {
  if (today === null || yesterday === null) return undefined;
  if (today === yesterday) return "Same as yesterday";

  return `${today > yesterday ? "↑" : "↓"} ${Math.abs(today - yesterday)} vs yesterday`;
}

function rateTile(label: string, figure: KpiFigure | undefined): PartnerOverviewTile {
  const base = { label, href: PARTNER_KPI_HREF };

  if (figure === undefined) return { ...base, value: NONE };
  if (figure.state === "not_available") return { ...base, value: formatKpiFigure(figure), caption: figure.reason };
  if (figure.state === "no_data") return { ...base, value: formatKpiFigure(figure), caption: NO_COMPLETED_CAPTION };

  return { ...base, value: formatKpiFigure(figure), caption: `${figure.numerator} / ${figure.denominator} bookings` };
}

function incidentsTile(core: CoreKpis | null, resolved: number | null): PartnerOverviewTile {
  const base = { label: "Operational incidents", href: PARTNER_KPI_HREF };
  const figure = core?.incidents;
  const caption = resolved === null ? undefined : `${resolved} resolved this month`;

  if (!figure) return { ...base, value: NONE };
  // The figure counts the incidents of the completed rentals: with none, it is a gap, never a 0 (R13).
  if (figure.state === "no_data") return { ...base, value: NO_DATA_TEXT, caption: NO_COMPLETED_CAPTION };

  return { ...base, value: String(figure.incidents), caption };
}

function completedTile(core: CoreKpis | null, monthName: string): PartnerOverviewTile {
  const base = { label: "Completed rentals", href: PARTNER_KPI_HREF, caption: `${monthName} to date` };
  const figure = core?.incidents;

  if (!figure) return { ...base, value: NONE };

  return { ...base, value: figure.state === "no_data" ? NO_DATA_TEXT : String(figure.completed_bookings) };
}

const wholeAmount = (value: number): string => formatTileAmount(value).slice(1);

function buildLaunchCredit(finance: PartnerFinanceData | null): PartnerOverviewLaunchCredit | null {
  const terms = finance?.terms;

  if (!terms || terms.launch_credit_target === null) return null;

  const target = terms.launch_credit_target;
  const accumulated = terms.launch_credit_accumulated ?? 0;
  const { percent, share } = meterProgress(accumulated, target);

  if (percent === null || share === null) return null;

  const current = terms.launch_mode ? terms.launch_partner_share_percent : terms.partner_share_percent;
  const after = `${terms.partner_share_percent} / ${100 - terms.partner_share_percent}`;
  const remaining = Math.max(0, target - accumulated);

  return {
    amount: `USD ${wholeAmount(accumulated)} / ${wholeAmount(target)}`,
    share: `${current} / ${100 - current} current share`,
    percent,
    progress: `${share}%`,
    note: terms.launch_mode
      ? `USD ${wholeAmount(remaining)} remaining. Share becomes ${after} after the launch-credit target is reached.`
      : null,
  };
}

function buildRevenue(finance: PartnerFinanceData | null): PartnerOverviewRevenueRow[] {
  const settlement = finance?.settlement ?? null;
  const open = finance ? summarizeOpenInvoices(finance.invoices) : null;

  return [
    { label: "Gross child-seat revenue", value: settlement ? formatInvoiceTotal(settlement.gross_revenue) : NONE },
    { label: "Partner revenue share", value: settlement ? formatInvoiceTotal(settlement.partner_share) : NONE },
    { label: "Amount payable", value: settlement ? formatInvoiceTotal(settlement.final_amount) : NONE },
    { label: "Open invoices", value: open ? String(open.count) : NONE },
    { label: "Outstanding invoice value", value: open ? formatInvoiceTotal(open.value) : NONE },
  ];
}

/**
 * Pure (VI-F11-S10). The Partner Overview from what the database gave: the eight tiles in the order of the
 * design, the revenue rows and the launch credit. A figure with no source has a dash, never a made-up 0.
 */
export function buildPartnerOverview(inputs: PartnerOverviewInputs, now: Date): PartnerOverviewView {
  const monthName = formatMonth(`${currentMonthParam(now)}-01`).split(" ")[0];
  const core = inputs.core;

  return {
    tiles: [
      {
        label: "Rentals today",
        value: count(inputs.rentals_today),
        caption: rentalsTodayCaption(inputs.rentals_today, inputs.rentals_yesterday),
        href: PARTNER_KPI_HREF,
      },
      { label: "Active rentals", value: count(inputs.active_rentals), caption: "Currently in use", href: PARTNER_KPI_HREF },
      {
        label: "Upcoming reservations",
        value: count(inputs.upcoming_reservations),
        caption: "Next 7 days",
        href: PARTNER_KPI_HREF,
      },
      {
        label: "Family Ready vehicles",
        value: count(inputs.family_ready),
        caption: inputs.awaiting_installation === null ? undefined : `${inputs.awaiting_installation} awaiting installation`,
        href: PARTNER_KPI_HREF,
      },
      rateTile("Correct-seat fulfilment", core?.correct_seat),
      rateTile("On-time readiness", core?.family_ready_on_time),
      incidentsTile(core, inputs.resolved_incidents),
      completedTile(core, monthName),
    ],
    revenue: buildRevenue(inputs.finance),
    launch_credit: buildLaunchCredit(inputs.finance),
  };
}
