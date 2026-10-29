import { toCents } from "@/lib/money/money";
import type { Database } from "@/types/database.types";

export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];

/** What the partner may see of an invoice: a draft or a void one is internal. */
export const PARTNER_INVOICE_STATUSES = ["issued", "paid", "overdue"] as const;

/** What the partner may see of a settlement: a draft or one waiting for approval can still change. */
export const PARTNER_SETTLEMENT_STATUSES = ["approved", "paid"] as const;

/** An invoice that still has to be paid. */
const OPEN_INVOICE_STATUSES: readonly InvoiceStatus[] = ["issued", "overdue"];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export interface FinanceSettlement {
  period_start: string;
  gross_revenue: number;
  partner_share: number;
  final_amount: number;
}

export interface FinanceInvoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  total: number;
  status: InvoiceStatus;
  /** The month of the settlement the invoice belongs to; `null` for an invoice with no settlement. */
  period_start: string | null;
}

export interface FinanceTerms {
  partner_share_percent: number;
  launch_partner_share_percent: number;
  launch_mode: boolean;
  launch_credit_target: number | null;
  launch_credit_accumulated: number | null;
}

export interface PartnerFinanceData {
  settlement: FinanceSettlement | null;
  invoices: readonly FinanceInvoice[];
  terms: FinanceTerms | null;
}

export interface FinanceTile {
  label: string;
  value: string;
  caption: string;
}

export interface FinanceInvoiceRow {
  id: string;
  invoice_number: string;
  period: string;
  issued: string;
  total: string;
  status: string;
}

export interface FinanceLaunchCredit {
  accumulated: number;
  target: number | null;
}

export interface PartnerFinanceView {
  tiles: FinanceTile[];
  invoices: FinanceInvoiceRow[];
  launch_credit: FinanceLaunchCredit;
  /** Nothing to show yet: no settlement and no invoice. */
  is_empty: boolean;
}

const NONE = "—";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const groupThousands = (whole: string): string => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** `5953.5` -> `5,953.50`. Two decimals, thousands separated. */
function twoDecimals(value: number): string {
  const cents = Math.abs(toCents(value));
  const whole = groupThousands(String(Math.trunc(cents / 100)));
  const text = `${whole}.${String(cents % 100).padStart(2, "0")}`;

  return toCents(value) < 0 ? `-${text}` : text;
}

/** The figure of a tile: `$12,000`, and `$12,000.50` when there are cents. */
export function formatTileAmount(value: number): string {
  const text = twoDecimals(value);

  return `$${text.endsWith(".00") ? text.slice(0, -3) : text}`;
}

/** The total of an invoice: `USD 5,953.50`. */
export function formatInvoiceTotal(value: number): string {
  return `USD ${twoDecimals(value)}`;
}

/** `2026-10-01` -> `October 2026`. */
export function formatMonth(date: string): string {
  const [year, month] = date.split("-");

  return `${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

/** `2026-10-31` -> `31 Oct 2026`. */
export function formatIssueDate(date: string): string {
  const [year, month, day] = date.split("-");
  const name = MONTHS[Number(month) - 1];

  return `${Number(day)} ${name ? name.slice(0, 3) : month} ${year}`;
}

/** The open invoices: how many, and their value in whole cents so the sum is exact. */
export function summarizeOpenInvoices(invoices: readonly FinanceInvoice[]): {
  count: number;
  value: number;
} {
  const open = invoices.filter((invoice) => OPEN_INVOICE_STATUSES.includes(invoice.status));
  const cents = open.reduce((sum, invoice) => sum + toCents(invoice.total), 0);

  return { count: open.length, value: cents / 100 };
}

function shareCaption(terms: FinanceTerms | null): string {
  if (terms === null) {
    return "USD";
  }

  return terms.launch_mode
    ? `USD · Launch share ${terms.launch_partner_share_percent}%`
    : `USD · Standard share ${terms.partner_share_percent}%`;
}

/**
 * Pure (VI-F04-S14). The partner finance screen from what the database gave: the latest settlement
 * for the three first tiles, the open invoices for the fourth, one row per invoice, and the launch
 * credit of the terms in use. A figure with no source has a dash, never a made-up number.
 */
export function buildPartnerFinance({
  settlement,
  invoices,
  terms,
}: PartnerFinanceData): PartnerFinanceView {
  const open = summarizeOpenInvoices(invoices);
  const month = settlement ? formatMonth(settlement.period_start) : null;

  return {
    tiles: [
      {
        label: "Gross revenue",
        value: settlement ? formatTileAmount(settlement.gross_revenue) : NONE,
        caption: month ? `USD · ${month}` : "USD",
      },
      {
        label: "Partner share",
        value: settlement ? formatTileAmount(settlement.partner_share) : NONE,
        caption: shareCaption(terms),
      },
      {
        label: "Amount payable",
        value: settlement ? formatTileAmount(settlement.final_amount) : NONE,
        caption: "USD · Before VAT",
      },
      {
        label: "Outstanding invoices",
        value: formatTileAmount(open.value),
        caption: `USD · ${open.count} open ${open.count === 1 ? "invoice" : "invoices"}`,
      },
    ],
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      period: invoice.period_start ? formatMonth(invoice.period_start) : NONE,
      issued: formatIssueDate(invoice.issue_date),
      total: formatInvoiceTotal(invoice.total),
      status: INVOICE_STATUS_LABEL[invoice.status],
    })),
    launch_credit: {
      accumulated: terms?.launch_credit_accumulated ?? 0,
      target: terms?.launch_credit_target ?? null,
    },
    is_empty: settlement === null && invoices.length === 0,
  };
}
