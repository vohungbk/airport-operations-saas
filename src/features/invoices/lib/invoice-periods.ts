import { formatMonth } from "@/features/partners/lib/partner-finance";
import { invoiceAmounts, type InvoiceAmounts } from "@/features/invoices/lib/invoice-amounts";

/** A settlement of a partner, with the invoice already made from it (one that is not void), if any. */
export interface SettlementPeriodRow {
  partner_id: string;
  /** The first day of the month: `2026-09-01`. */
  period_start: string;
  status: string;
  platform_share: number;
  fees: number;
  invoice_id: string | null;
}

export interface PeriodOption {
  /** `YYYY-MM`, the value of the form. */
  month: string;
  label: string;
  /** Only the month of an approved settlement can be chosen. */
  selectable: boolean;
  caption: string;
  /** The invoice already made from this settlement. */
  invoice_id: string | null;
  amounts: InvoiceAmounts;
}

/** The months shown for a partner: the newest settlements, not every one it ever had. */
export const PERIOD_LIMIT = 12;

export const SELECTABLE_CAPTION = "Approved / selectable";
export const DISABLED_CAPTION = "No approved settlement / disabled";

/**
 * Pure (VI-F09-S06). The months of one partner, newest first: an approved settlement can be chosen, any other
 * is shown disabled. The amounts are what the invoice will be worth, shown before it is made.
 */
export function buildPeriodOptions(rows: readonly SettlementPeriodRow[], partnerId: string): PeriodOption[] {
  return rows
    .filter((row) => row.partner_id === partnerId)
    .toSorted((a, b) => b.period_start.localeCompare(a.period_start))
    .slice(0, PERIOD_LIMIT)
    .map((row) => {
      const selectable = row.status === "approved";

      return {
        month: row.period_start.slice(0, 7),
        label: formatMonth(row.period_start),
        selectable,
        caption: selectable ? SELECTABLE_CAPTION : DISABLED_CAPTION,
        invoice_id: row.invoice_id,
        amounts: invoiceAmounts(row.platform_share, row.fees),
      };
    });
}
