import type { Database } from "@/types/database.types";

export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];

export const INVOICE_STATUSES = ["draft", "issued", "paid", "overdue", "void"] as const satisfies readonly InvoiceStatus[];

/** What a partner user is shown: a draft or a void invoice is internal. */
export const PARTNER_INVOICE_STATUSES = ["issued", "paid", "overdue"] as const satisfies readonly InvoiceStatus[];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

/** The statuses a role may see and filter by. */
export function visibleInvoiceStatuses(isPartner: boolean): readonly InvoiceStatus[] {
  return isPartner ? PARTNER_INVOICE_STATUSES : INVOICE_STATUSES;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** `2026-09-01` -> `Sep 2026`. */
export function formatShortMonth(date: string): string {
  const [year, month] = date.split("-");

  return `${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

/** `2026-11-15` -> `15 Nov 2026`. */
export function formatInvoiceDate(date: string): string {
  const [year, month, day] = date.split("-");

  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

/** `2400` -> `USD 2,400.00`. */
export function formatInvoiceAmount(value: number): string {
  const cents = Math.round(Math.abs(value) * 100);
  const whole = String(Math.trunc(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const text = `USD ${whole}.${String(cents % 100).padStart(2, "0")}`;

  return value < 0 ? `-${text}` : text;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The whole days an invoice is past its due date, or `null` when it is not past it. Both are UTC dates. */
export function overdueDays(dueDate: string, today: string): number | null {
  const days = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / DAY_MS);

  return Number.isFinite(days) && days > 0 ? days : null;
}

export interface InvoiceListRow {
  id: string;
  invoice_number: string;
  partner: { name: string; code: string } | null;
  /** The month the invoice covers; `null` for an invoice with no settlement. */
  period_start: string | null;
  issue_date: string;
  due_date: string;
  total: number;
  status: InvoiceStatus;
}

export interface InvoiceRowView {
  id: string;
  invoice_number: string;
  partner: string | null;
  period: string;
  amount: string;
  due_date: string;
  /** "Overdue by 12 days", only for an invoice whose status is overdue. */
  overdue_note: string | null;
  status: InvoiceStatus;
}

const NONE = "—";

/** Pure. The rows of the table as they are written; nothing is calculated again in the component. */
export function buildInvoiceRows(rows: readonly InvoiceListRow[], today: string): InvoiceRowView[] {
  return rows.map((row) => {
    const late = row.status === "overdue" ? overdueDays(row.due_date, today) : null;

    return {
      id: row.id,
      invoice_number: row.invoice_number,
      partner: row.partner?.name ?? null,
      period: row.period_start ? formatShortMonth(row.period_start) : NONE,
      amount: formatInvoiceAmount(row.total),
      due_date: formatInvoiceDate(row.due_date),
      overdue_note: late === null ? null : `Overdue by ${late} ${late === 1 ? "day" : "days"}`,
      status: row.status,
    };
  });
}

/** "Showing 1–9 of 9", or "Showing 0 of 0". */
export function showingText(page: number, pageSize: number, total: number): string {
  if (total === 0) {
    return "Showing 0 of 0";
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return `Showing ${from}–${to} of ${total}`;
}
