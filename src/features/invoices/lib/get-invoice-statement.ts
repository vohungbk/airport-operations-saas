import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { visibleInvoiceStatuses } from "@/features/invoices/lib/invoice-list";
import type { StatementBooking } from "@/features/invoices/lib/invoice-statement-csv";

/** The bookings read at a time, so a statement of any length is never held whole in memory. */
export const STATEMENT_BATCH = 1000;

const BOOKING_COLUMNS =
  "booking_number, revenue_case, paid_days, gross_revenue, partner_share, platform_share, launch_credit, adjustments_total, return_at, actual_return_at";

export interface InvoiceStatementHead {
  invoice_number: string;
  partner_id: string;
  /** The month the invoice covers; `null` for an invoice with no settlement, which has no bookings. */
  period_start: string | null;
}

interface HeadRow {
  invoice_number: string;
  partner_id: string;
  settlement: { period_start: string } | null;
}

/**
 * Server-only (VI-F09-S05). The invoice a statement is for, with the user's own client: RLS gives a partner user
 * only an invoice of its own partner, and a partner is shown only an issued, paid or overdue one. An id that is
 * malformed, does not exist or is hidden is the same `null`. A failed read is thrown.
 */
export async function getInvoiceStatementHead(id: string, isPartner: boolean): Promise<InvoiceStatementHead | null> {
  if (!z.guid().safeParse(id).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number, partner_id, settlement:settlements(period_start)")
    .eq("id", id)
    .in("status", [...visibleInvoiceStatuses(isPartner)])
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const { settlement, ...invoice } = data as unknown as HeadRow;

  return { ...invoice, period_start: settlement?.period_start ?? null };
}

/** The first and the next first day of the month of a settlement, in UTC, as the settlement counts its bookings. */
export function monthWindow(periodStart: string): { from: string; to: string } {
  const [year, month] = periodStart.split("-").map(Number);

  return {
    from: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    to: new Date(Date.UTC(year, month, 1)).toISOString(),
  };
}

/**
 * Server-only. The bookings of the statement, in batches in the order of their number (keyset, so a batch never
 * repeats or skips a row and a late batch costs no more than the first). They are the bookings the settlement of
 * the month counted: completed rentals of the partner with revenue (standard or early return), in the month of
 * the day they were really returned, or were due when there is no return time (UTC). RLS is the scope. A failed
 * read is thrown.
 */
export async function* statementBookingBatches(head: InvoiceStatementHead): AsyncGenerator<StatementBooking[]> {
  if (head.period_start === null) {
    return;
  }

  const { from, to } = monthWindow(head.period_start);
  const supabase = await createClient();
  let after: string | null = null;

  while (true) {
    let request = supabase
      .from("bookings")
      .select(BOOKING_COLUMNS)
      .eq("partner_id", head.partner_id)
      .eq("status", "completed")
      .in("revenue_case", ["standard", "early_return"])
      .not("gross_revenue", "is", null)
      .or(
        `and(actual_return_at.gte.${from},actual_return_at.lt.${to}),and(actual_return_at.is.null,return_at.gte.${from},return_at.lt.${to})`,
      )
      .order("booking_number", { ascending: true })
      .limit(STATEMENT_BATCH);

    if (after !== null) {
      request = request.gt("booking_number", after);
    }

    const { data, error } = await request;

    if (error) {
      throw error;
    }

    const batch = (data ?? []) as unknown as StatementBooking[];

    if (batch.length === 0) {
      return;
    }

    yield batch;

    if (batch.length < STATEMENT_BATCH) {
      return;
    }

    after = batch[batch.length - 1].booking_number;
  }
}
