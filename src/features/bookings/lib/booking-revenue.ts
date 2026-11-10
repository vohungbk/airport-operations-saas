import { platformShareOf } from "@/features/partners/lib/commercial-terms";
import type { BookingAdjustmentRow } from "@/features/bookings/lib/get-booking-adjustments";
import type { BookingRevenueRow } from "@/features/bookings/lib/get-booking-revenue";
import type { AdjustmentType } from "@/features/bookings/schemas/adjustment.schema";

export interface RevenueLine {
  label: string;
  value: string;
  /** A negative amount: shown in the danger color. */
  negative?: boolean;
}

/** The card of the Revenue tab: two columns of lines and the lines that say how the amounts were reached. */
export interface RevenueCard {
  left: RevenueLine[];
  right: RevenueLine[];
  formula: string[];
}

export type BookingRevenueView =
  | { state: "empty"; message: string }
  | { state: "ready"; caseLabel: string; notices: string[]; card: RevenueCard };

/** A rental is charged for at most this many days. */
export const PAID_DAYS_CAP = 6;

export interface BuildRevenueOptions {
  /** The adjustments of the booking, for the lines per type; only the operations team has them. */
  adjustments?: readonly Pick<BookingAdjustmentRow, "type" | "amount">[];
  /** `false` for a partner user: no platform share, no launch credit and no lines per type. */
  internal?: boolean;
}

const CASE_LABEL: Record<string, string> = {
  standard: "Standard rental",
  early_return: "Returned early",
  cancelled: "Cancelled",
  no_show: "No-show",
};

/** The currency the Revenue tab names (UI-F06-T04): shown as text in the heading, the column and the formula; the amounts are stored without one. */
export const REVENUE_CURRENCY = "USD";

/** `USD 20.00` and `-USD 20.00`: the sign comes before the currency. */
export const formatUsd = (value: number): string =>
  `${value < 0 ? "-" : ""}${REVENUE_CURRENCY} ${Math.abs(value).toFixed(2)}`;

/** Money as the database holds it: two decimals, no currency (the currency is still open, spec Q1). */
export const formatMoney = (value: number | null): string =>
  value === null ? "Not calculated" : value.toFixed(2);

const percent = (value: number) => `${value}%`;

export const round2 = (value: number) => Math.round(value * 100) / 100;

const line = (label: string, value: number | null): RevenueLine => ({
  label,
  value: formatMoney(value),
  negative: value !== null && value < 0,
});

const REFUND_TYPES: AdjustmentType[] = ["partial_refund", "full_refund"];

/** What the adjustments of the given types took off: zero, or negative. */
const takenOff = (adjustments: BuildRevenueOptions["adjustments"], types: AdjustmentType[]): number =>
  round2(0 - (adjustments ?? []).filter((a) => types.includes(a.type)).reduce((sum, a) => sum + a.amount, 0));

/**
 * Pure (VI-F04-S08, spec R3; UI-F06-T04). How the revenue of a booking was calculated, from the figures
 * the database stored: nothing is calculated again here, so the screen can never disagree with the
 * booking. The stored gross revenue is already net of the adjustments, so it is the Net revenue and the
 * two shares add up to it. A booking with no revenue case has no revenue yet (the rental is not completed).
 */
export function buildBookingRevenue(row: BookingRevenueRow, options: BuildRevenueOptions = {}): BookingRevenueView {
  const { adjustments, internal = true } = options;

  if (row.revenue_case === null) {
    return {
      state: "empty",
      message:
        row.status === "completed"
          ? "This rental was completed before its revenue was recorded, so there is no breakdown."
          : "There is no revenue yet: the rental is not completed.",
    };
  }

  const notices: string[] = [];

  if (row.revenue_case === "cancelled" || row.revenue_case === "no_show") {
    notices.push(
      row.revenue_case === "cancelled"
        ? "This booking was cancelled, so it is not charged."
        : "This booking was a no-show, so it is not charged.",
    );
  }
  if (row.revenue_flag === "invalid_duration") {
    notices.push(
      "The rental has no duration, so it is not charged. It is charged once its period is corrected.",
    );
  }
  if (row.revenue_flag === "no_terms") {
    notices.push(
      "The partner had no commercial terms in force when the rental was completed, so the shares are not calculated.",
    );
  }

  const launchApplied = row.launch_credit_balance !== null;
  const partnerBasis = row.terms
    ? percent(launchApplied ? row.terms.launch_partner_share_percent : row.terms.partner_share_percent)
    : null;
  const platformBasis = row.terms
    ? percent(launchApplied ? platformShareOf(row.terms.launch_partner_share_percent) : row.terms.platform_share_percent)
    : null;
  const shareLabel = (name: string, basis: string | null) => (basis ? `${name} · ${basis}` : name);

  const net = row.gross_revenue;
  const grossBefore = net === null ? null : round2(net - row.adjustments_total);

  const left: RevenueLine[] = [
    {
      label: "Paid days",
      value:
        row.rental_days === null
          ? String(row.paid_days)
          : `${row.rental_days} days booked, ${row.paid_days} days paid`,
    },
    line("Daily rate", row.daily_rate),
    line("Gross revenue", grossBefore),
  ];
  if (internal) {
    left.push(
      line("Refund", takenOff(adjustments, REFUND_TYPES)),
      line("Adjustment", takenOff(adjustments, ["manual_adjustment"])),
      line("Chargeback", takenOff(adjustments, ["chargeback"])),
    );
  }

  const right: RevenueLine[] = [
    line("Total adjustments", row.adjustments_total),
    line("Net revenue", net),
    { ...line(shareLabel("Partner share", partnerBasis), row.partner_share), negative: false },
  ];
  if (internal) {
    right.push(
      { ...line(shareLabel("Platform share", platformBasis), row.platform_share), negative: false },
      { label: "Launch-credit effect", value: formatMoney(row.launch_credit) },
    );
  }

  const formula: string[] = [];
  if (net !== null && row.rental_days !== null && row.paid_days > 0) {
    const adjusted = row.adjustments_total < 0 ? ` + (${formatMoney(row.adjustments_total)})` : "";
    formula.push(
      `How this is calculated: min(${row.rental_days}, ${PAID_DAYS_CAP}) × ${formatUsd(row.daily_rate)}${adjusted} = ${formatUsd(net)}`,
    );
  }
  if (net !== null && row.partner_share !== null && row.platform_share !== null) {
    const partner = `Partner ${partnerBasis ?? ""} = ${formatUsd(row.partner_share)}`.replace("  ", " ");
    formula.push(
      internal
        ? `${partner} + Platform ${platformBasis ?? ""} = ${formatUsd(row.platform_share)}. Total ${formatUsd(net)}. Launch credit ${formatUsd(row.launch_credit)}.`.replace("  ", " ")
        : `${partner}.`,
    );
  }

  return {
    state: "ready",
    caseLabel: CASE_LABEL[row.revenue_case] ?? row.revenue_case,
    notices,
    card: { left, right, formula },
  };
}
