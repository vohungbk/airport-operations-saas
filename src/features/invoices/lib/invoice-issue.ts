import { formatDay, paymentTermsText } from "@/features/invoices/lib/invoice-detail";

/** `2026-10-01` plus 30 days is `2026-10-31`. UTC, so the date does not move with the time zone of the server. */
export function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);

  return next.toISOString().slice(0, 10);
}

/** What the confirmation says before a draft is issued (the Issue confirmation of the design). */
export interface IssuePreview {
  /** `INV-2026-000044 / Emirates Rent A Car`. */
  heading: string;
  issue_date: string;
  payment_terms: string;
  due_date: string;
}

interface IssuePreviewInput {
  invoice_number: string;
  partner_name: string | null;
  payment_terms_days: number;
  /** The date of today in UTC, `YYYY-MM-DD`: the date the invoice will be issued on. */
  today: string;
}

/**
 * Pure (VI-F09-S07). The issue date is today and the due date is that day plus the payment terms of the partner, as
 * `issue_invoice()` works them out. The database does it again when the invoice is issued.
 */
export function buildIssuePreview({ invoice_number, partner_name, payment_terms_days, today }: IssuePreviewInput): IssuePreview {
  return {
    heading: partner_name ? `${invoice_number} / ${partner_name}` : invoice_number,
    issue_date: formatDay(today),
    payment_terms: paymentTermsText(payment_terms_days),
    due_date: formatDay(addDays(today, payment_terms_days)),
  };
}
