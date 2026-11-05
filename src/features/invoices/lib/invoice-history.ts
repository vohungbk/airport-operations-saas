import { INVOICE_STATUS_LABEL, MONTHS, type InvoiceStatus } from "@/features/invoices/lib/invoice-list";

/** The time zone the Invoice history screen shows its times in, as the design says (GST, UTC+4). */
export const HISTORY_TIME_ZONE = "Asia/Dubai";
export const HISTORY_TIME_ZONE_LABEL = "GST (UTC+4)";

/** One event of `get_invoice_history()`: the creation of an invoice or a change of its status. */
export interface InvoiceHistoryRow {
  id: string;
  invoice_id: string;
  invoice_number: string;
  from_status: string | null;
  to_status: string;
  reason: string;
  /** Null when the database made the change itself (an invoice that became overdue by itself). */
  actor_name: string | null;
  changed_at: string;
}

/** The actor shown when no person made the change. */
export const SYSTEM_ACTOR = "System";

const EVENT_LABEL: Partial<Record<InvoiceStatus, string>> = {
  issued: "Issued",
  overdue: "Marked overdue",
  paid: "Paid",
  void: "Voided",
};

/** What happened: the creation of the invoice (nothing before it), or the status it moved to. */
export function historyEventLabel(fromStatus: string | null, toStatus: string): string {
  if (fromStatus === null) {
    return "Generated";
  }

  return EVENT_LABEL[toStatus as InvoiceStatus] ?? INVOICE_STATUS_LABEL[toStatus as InvoiceStatus] ?? toStatus;
}

/** `INV-2026-000031` -> `000031`, the part of the number that tells the invoices of a year apart. */
export function invoiceNumberSuffix(invoiceNumber: string): string {
  return invoiceNumber.slice(invoiceNumber.lastIndexOf("-") + 1);
}

const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: HISTORY_TIME_ZONE,
  day: "2-digit",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** `2026-09-01T05:00:00Z` -> `01 Sep 2026, 09:00 GST`. The month is named here, so it does not depend on the locale data. */
export function formatHistoryTime(iso: string): string {
  const parts = TIME_FORMAT.formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";

  return `${part("day")} ${MONTHS[Number(part("month")) - 1]} ${part("year")}, ${part("hour")}:${part("minute")} GST`;
}

/** One row of the history card: what happened, who did it, when and why. */
export interface HistoryEvent {
  id: string;
  title: string;
  actor: string;
  occurred_at: string;
  note: string;
}

/** The events in the order of the rows (the database sorts them, oldest first). */
export function buildHistoryEvents(rows: readonly InvoiceHistoryRow[]): HistoryEvent[] {
  return rows.map((row) => ({
    id: row.id,
    title: `${historyEventLabel(row.from_status, row.to_status)} / ${invoiceNumberSuffix(row.invoice_number)}`,
    actor: row.actor_name ?? SYSTEM_ACTOR,
    occurred_at: row.changed_at,
    note: row.reason,
  }));
}

/** The years of the Period field: from the year of the oldest issue date to this year, newest first. */
export function historyYears(issueDates: readonly string[], currentYear: number): number[] {
  const first = Math.min(currentYear, ...issueDates.map((date) => Number(date.slice(0, 4))).filter(Number.isFinite));

  return Array.from({ length: currentYear - first + 1 }, (_, i) => currentYear - i);
}

/** The year it is now in the time zone of the screen, which the Period field starts on. */
export function currentHistoryYear(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: HISTORY_TIME_ZONE, year: "numeric" }).format(now));
}

/** The address of the Invoice history screen, with the invoice and the year when they are given. */
export function buildInvoiceHistoryHref(query: { invoice_id?: string; year?: number }): string {
  const params = new URLSearchParams();

  if (query.invoice_id) params.set("invoice_id", query.invoice_id);
  if (query.year) params.set("year", String(query.year));

  const search = params.toString();

  return search ? `/invoices/history?${search}` : "/invoices/history";
}
