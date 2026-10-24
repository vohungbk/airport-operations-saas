import type { BookingRevenueRow } from "@/features/bookings/lib/get-booking-revenue";

export interface RevenueLine {
  label: string;
  value: string;
}

export type BookingRevenueView =
  | { state: "empty"; message: string }
  | { state: "ready"; caseLabel: string; notices: string[]; lines: RevenueLine[] };

const CASE_LABEL: Record<string, string> = {
  standard: "Standard rental",
  early_return: "Returned early",
  cancelled: "Cancelled",
  no_show: "No-show",
};

/** Money as the database holds it: two decimals, no currency (the currency is still open, spec Q1). */
export const formatMoney = (value: number | null): string =>
  value === null ? "Not calculated" : value.toFixed(2);

const percent = (value: number) => `${value}%`;

/**
 * Pure (VI-F04-S08, spec R3). How the revenue of a booking was calculated, from the figures the
 * database stored: nothing is calculated again here, so the screen can never disagree with the
 * booking. A booking with no revenue case has no revenue yet (the rental is not completed).
 */
export function buildBookingRevenue(row: BookingRevenueRow): BookingRevenueView {
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
  const shareBasis = row.terms
    ? percent(launchApplied ? row.terms.launch_partner_share_percent : row.terms.partner_share_percent)
    : null;
  const platformBasis = row.terms
    ? percent(
        launchApplied
          ? Math.round((100 - row.terms.launch_partner_share_percent) * 100) / 100
          : row.terms.platform_share_percent,
      )
    : null;
  const withBasis = (amount: number | null, basis: string | null) =>
    amount === null ? formatMoney(null) : basis ? `${formatMoney(amount)} (${basis})` : formatMoney(amount);

  const capped = row.rental_days !== null && row.rental_days > row.paid_days;

  const lines: RevenueLine[] = [
    { label: "Case", value: CASE_LABEL[row.revenue_case] ?? row.revenue_case },
    { label: "Rental days", value: row.rental_days === null ? "-" : String(row.rental_days) },
    {
      label: "Paid days",
      value: capped
        ? `${row.paid_days} (only the first ${row.paid_days} of ${row.rental_days} days are charged)`
        : String(row.paid_days),
    },
    { label: "Daily rate", value: formatMoney(row.daily_rate) },
    {
      label: "Gross revenue",
      value:
        row.adjustments_total < 0 && row.gross_revenue !== null
          ? `${formatMoney(row.gross_revenue)} (after ${formatMoney(-row.adjustments_total)} of adjustments)`
          : formatMoney(row.gross_revenue),
    },
    {
      label: "Adjustments",
      value: row.adjustments_total < 0 ? formatMoney(row.adjustments_total) : "None",
    },
    { label: "Partner share", value: withBasis(row.partner_share, shareBasis) },
    { label: "Platform share", value: withBasis(row.platform_share, platformBasis) },
    {
      label: "Launch credit",
      value: launchApplied
        ? `${formatMoney(row.launch_credit)} added (balance after this rental ${formatMoney(row.launch_credit_balance)})`
        : "Launch terms did not apply",
    },
    {
      label: "Terms used",
      value: row.terms ? `In force from ${row.terms.effective_from}` : "None",
    },
  ];

  return { state: "ready", caseLabel: CASE_LABEL[row.revenue_case] ?? row.revenue_case, notices, lines };
}
