import { type NextRequest, NextResponse } from "next/server";

import { apiError } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPartnerAccessIssue } from "@/lib/auth/partner-scope";
import { FINANCE_ACCESS_PERMISSIONS, hasAnyPermission } from "@/lib/auth/permissions";
import { getInvoiceStatementHead, statementBookingBatches } from "@/features/invoices/lib/get-invoice-statement";
import {
  invoiceStatementFileName,
  statementCsvLines,
  statementCsvStart,
} from "@/features/invoices/lib/invoice-statement-csv";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * VI-F09-S05: the booking statement of an invoice as a CSV download. The caller must be signed in and hold a
 * finance permission; RLS then decides whether the invoice and its bookings are theirs to read, and a partner user
 * is given only an issued, paid or overdue invoice of its own partner. An invoice that is unknown, malformed or
 * hidden is the same 404. The bookings are read in batches and streamed, so a statement of any length is produced
 * without being held whole or waiting for the last row. The first batch is read before the answer starts, so a
 * failure there is the standardized error shape; a failure after that ends the download. Nothing is written.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sign in to download this statement.");
  }
  if (!hasAnyPermission(user.role, FINANCE_ACCESS_PERMISSIONS) || getPartnerAccessIssue(user) !== null) {
    return apiError("FORBIDDEN", "You cannot download this statement.");
  }

  const { id } = await params;

  try {
    const head = await getInvoiceStatementHead(id, user.role === "partner_user");
    if (!head) {
      return apiError("NOT_FOUND", "Invoice not found.");
    }

    const batches = statementBookingBatches(head);
    const first = await batches.next();
    const encoder = new TextEncoder();

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(statementCsvStart() + (first.done ? "" : statementCsvLines(first.value))));

        if (first.done) {
          controller.close();
        }
      },
      async pull(controller) {
        try {
          const next = await batches.next();

          if (next.done) {
            controller.close();
          } else {
            controller.enqueue(encoder.encode(statementCsvLines(next.value)));
          }
        } catch (error) {
          controller.error(error);
        }
      },
      async cancel() {
        await batches.return(undefined);
      },
    });

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${invoiceStatementFileName(head.invoice_number)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return apiError("INTERNAL_ERROR", "The statement could not be built. Please try again.");
  }
}
