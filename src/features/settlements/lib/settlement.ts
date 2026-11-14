import type { Database } from "@/types/database.types";

export type SettlementStatus = Database["public"]["Enums"]["settlement_status"];

/** `YYYY-MM` -> the first day of that month, the date the database function is given. */
export const monthToDate = (month: string): string => `${month}-01`;

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  paid: "Paid",
};

/** The month a settlement covers, as `YYYY-MM`. */
export const settlementMonth = (periodStart: string): string => periodStart.slice(0, 7);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** `2026-10-01` -> `October 2026`, the period as the list shows it. */
export function settlementPeriodLabel(periodStart: string): string {
  const [year, month] = periodStart.split("-");

  return `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}`;
}

/** `11865` -> `11,865.00`: two decimals and thousands separators, no currency (the list says "USD" once). */
export function formatSettlementAmount(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface SettlementMove {
  to: SettlementStatus;
  label: string;
}

/**
 * VI-F04-S13 (spec R8): the moves a settlement can make, as the database function allows them. The
 * list only decides which buttons are shown; the Server Action and the function check the move again.
 */
export const SETTLEMENT_MOVES: Record<SettlementStatus, readonly SettlementMove[]> = {
  draft: [{ to: "pending_approval", label: "Send for approval" }],
  pending_approval: [
    { to: "approved", label: "Approve" },
    { to: "draft", label: "Send back to draft" },
  ],
  approved: [{ to: "paid", label: "Mark as paid" }],
  paid: [],
};
