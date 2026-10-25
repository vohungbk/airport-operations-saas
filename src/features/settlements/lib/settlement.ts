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
