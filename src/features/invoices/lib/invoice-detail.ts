import { toCents } from "@/lib/money/money";
import { formatMonth } from "@/features/partners/lib/partner-finance";
import {
  INVOICE_STATUS_LABEL,
  formatInvoiceAmount,
  type InvoiceStatus,
} from "@/features/invoices/lib/invoice-list";

export interface InvoiceLineRow {
  position: number;
  description: string;
  /** Signed: a credit or a refund is negative. */
  amount: number;
  /** A part of the subtotal, as opposed to a figure that only shows where the subtotal comes from. */
  counts_toward_subtotal: boolean;
}

export interface InvoiceDetailRow {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  vat: number;
  total: number;
  status: InvoiceStatus;
  partner: { name: string; code: string } | null;
  /** The month the invoice covers; `null` for an invoice with no settlement. */
  period_start: string | null;
  lines: InvoiceLineRow[];
}

export interface SummaryCard {
  label: string;
  value: string;
  caption: string;
}

export interface TableLine {
  description: string;
  amount: string;
  negative: boolean;
  /** Subtotal, VAT and Total: the rows under the lines. */
  is_total: boolean;
}

export interface PaymentStep {
  label: string;
  state: "done" | "current" | "upcoming";
}

export interface InvoiceDetailView {
  invoice_number: string;
  status: InvoiceStatus;
  meta: string;
  cards: SummaryCard[];
  /** The rows under the lines (subtotal, VAT, total) are always there; this says whether a line was recorded. */
  has_lines: boolean;
  lines: TableLine[];
  explanation: string | null;
  steps: PaymentStep[];
  side_states: Array<{ label: string; active: boolean }>;
  current: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const NONE = "—";
const DAY_MS = 24 * 60 * 60 * 1000;

/** `2026-10-01` -> `01 Oct 2026`, with the day of two digits as the design writes it. */
function formatDay(date: string): string {
  const [year, month, day] = date.split("-");

  return `${day} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

/** The amount in the lines table, as the design writes it: `$8,000.00`, `-$150.00`. */
const lineAmount = (value: number) => formatInvoiceAmount(value).replace("USD ", "$");

/** The amount with no currency, for the sentence that explains the total: `3,200.00`. */
const plainAmount = (value: number) => formatInvoiceAmount(value).replace("USD ", "");

/** The whole days from the issue date to the due date: the payment terms the invoice was given. */
function paymentTermsDays(issueDate: string, dueDate: string): number | null {
  const days = Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${issueDate}T00:00:00Z`)) / DAY_MS);

  return Number.isFinite(days) && days >= 0 ? days : null;
}

/** `5` for a VAT of 252.50 on 5,050.00; `null` when there is no subtotal to take a rate of. */
export function vatRate(subtotal: number, vat: number): string | null {
  if (!(subtotal > 0)) {
    return null;
  }

  return String(Math.round((vat / subtotal) * 10000) / 100);
}

/** `Refunds (credit)` -> `refunds`: the name of a line inside the sentence. */
const inSentence = (description: string) => description.replace(/\s*\([^)]*\)\s*$/, "").toLowerCase();

/**
 * The sentence under the lines: the parts of the subtotal, then the VAT. It is written only when those parts
 * add up to the subtotal the invoice stored; a sentence that does not add up would explain nothing.
 */
function explain(row: InvoiceDetailRow): string | null {
  const parts = row.lines.filter((line) => line.counts_toward_subtotal && toCents(line.amount) !== 0);

  if (parts.length === 0 || parts.reduce((sum, line) => sum + toCents(line.amount), 0) !== toCents(row.subtotal)) {
    return null;
  }

  const text = parts
    .map((line, index) => {
      const sign = line.amount < 0 ? "- " : index === 0 ? "" : "+ ";

      return `${sign}${plainAmount(Math.abs(line.amount))} ${inSentence(line.description)}`;
    })
    .join(" ");

  return `How this total is calculated: ${text} = ${plainAmount(row.subtotal)}; + VAT ${plainAmount(row.vat)} = ${formatInvoiceAmount(row.total)}.`;
}

const STEPS = ["Draft", "Issued", "Paid"] as const;

/** Where the invoice is on Draft, Issued, Paid; an invoice that is overdue or void is on a side state. */
function paymentSteps(status: InvoiceStatus): Pick<InvoiceDetailView, "steps" | "side_states"> {
  const position = { draft: 0, issued: 1, overdue: 1, paid: 2, void: -1 }[status];

  return {
    steps: STEPS.map((label, index) => ({
      label,
      state: index < position ? "done" : index === position ? "current" : "upcoming",
    })),
    side_states: [
      { label: "Overdue", active: status === "overdue" },
      { label: "Void", active: status === "void" },
    ],
  };
}

const AMOUNT_LABEL: Record<InvoiceStatus, string> = {
  draft: "Amount due",
  issued: "Amount due",
  overdue: "Amount due",
  paid: "Amount paid",
  void: "Invoice total",
};

/**
 * Pure (VI-F09-S03). The invoice detail as the screen writes it, from the figures the database stored: the
 * lines in their order, then the subtotal, the VAT and the total of the invoice itself. Nothing is
 * calculated again, except the rate of the VAT and the payment terms, which are read off the figures.
 * `showPartner` is for the operations team; a partner user already knows whose invoice it is.
 */
export function buildInvoiceDetail(row: InvoiceDetailRow, showPartner: boolean): InvoiceDetailView {
  const rate = vatRate(row.subtotal, row.vat);
  const terms = paymentTermsDays(row.issue_date, row.due_date);

  return {
    invoice_number: row.invoice_number,
    status: row.status,
    meta: [
      showPartner ? (row.partner?.name ?? NONE) : null,
      row.period_start ? formatMonth(row.period_start) : null,
      `Issued ${formatDay(row.issue_date)}`,
      `Due ${formatDay(row.due_date)}`,
    ]
      .filter((part): part is string => part !== null)
      .join(" / "),
    cards: [
      { label: AMOUNT_LABEL[row.status], value: formatInvoiceAmount(row.total), caption: "Invoice total, including VAT" },
      {
        label: "Due date",
        value: formatDay(row.due_date),
        caption: terms === null ? "Payment terms: —" : `Payment terms: ${terms} ${terms === 1 ? "day" : "days"}`,
      },
      {
        label: rate === null ? "VAT" : `VAT / ${rate}%`,
        value: formatInvoiceAmount(row.vat),
        caption: `Subtotal ${formatInvoiceAmount(row.subtotal)}`,
      },
    ],
    has_lines: row.lines.length > 0,
    lines: [
      ...row.lines.map((line) => ({
        description: line.description,
        amount: lineAmount(line.amount),
        negative: line.amount < 0,
        is_total: false,
      })),
      { description: "Subtotal", amount: lineAmount(row.subtotal), negative: false, is_total: true },
      { description: rate === null ? "VAT" : `VAT ${rate}%`, amount: lineAmount(row.vat), negative: false, is_total: true },
      { description: "Total USD", amount: lineAmount(row.total), negative: false, is_total: true },
    ],
    explanation: explain(row),
    ...paymentSteps(row.status),
    current: `Current: ${INVOICE_STATUS_LABEL[row.status]}`,
  };
}
