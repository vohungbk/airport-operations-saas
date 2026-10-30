import { type NextRequest, NextResponse } from "next/server";

import { apiError } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPartnerAccessIssue } from "@/lib/auth/partner-scope";
import { FINANCE_ACCESS_PERMISSIONS, hasAnyPermission } from "@/lib/auth/permissions";
import { buildInvoicesCsv, invoicesCsvFileName } from "@/features/invoices/lib/invoices-csv";
import {
  INVOICE_EXPORT_LIMIT,
  InvoiceExportTooLargeError,
  getInvoicesForExport,
} from "@/features/invoices/lib/get-invoices";
import {
  invoicesQuerySchema,
  resolveInvoicesQuery,
} from "@/features/invoices/schemas/invoices-query.schema";
import { utcToday } from "@/features/partners/lib/commercial-terms";

/**
 * VI-F09-S02: the invoice list as a CSV download. It takes the filters and the sort of the list from the
 * address, and ignores the page: the file holds every invoice they match. The caller must be signed in and
 * hold a finance permission; RLS then decides which invoices are theirs, and a partner user is given only
 * the issued, paid and overdue ones of its own partner (the partner in the address is dropped for it). An
 * export above the limit is refused, never cut. The answer to a failure is the standardized error shape.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sign in to export invoices.");
  }
  if (!hasAnyPermission(user.role, FINANCE_ACCESS_PERMISSIONS) || getPartnerAccessIssue(user) !== null) {
    return apiError("FORBIDDEN", "You cannot export invoices.");
  }

  const isPartner = user.role === "partner_user";
  const query = resolveInvoicesQuery(invoicesQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams)), isPartner);

  let csv: string;
  try {
    csv = buildInvoicesCsv(await getInvoicesForExport(query, isPartner), !isPartner);
  } catch (error) {
    if (error instanceof InvoiceExportTooLargeError) {
      return apiError(
        "VALIDATION_ERROR",
        `More than ${INVOICE_EXPORT_LIMIT} invoices match. Narrow the filters and export again.`,
      );
    }
    return apiError("INTERNAL_ERROR", "The invoices could not be exported. Please try again.");
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${invoicesCsvFileName(utcToday())}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
