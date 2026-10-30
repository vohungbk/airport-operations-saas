import { type NextRequest, NextResponse } from "next/server";

import { apiError } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPartnerAccessIssue } from "@/lib/auth/partner-scope";
import { FINANCE_ACCESS_PERMISSIONS, hasAnyPermission } from "@/lib/auth/permissions";
import { getInvoice } from "@/features/invoices/lib/get-invoice";
import { buildInvoicePdf } from "@/features/invoices/lib/invoice-pdf";
import { invoicePdfFileName } from "@/features/invoices/lib/invoice-pdf-file-name";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * VI-F09-S04: the invoice as a PDF download. The caller must be signed in and hold a finance permission;
 * RLS then decides whether the invoice is theirs to read, and a partner user is given only an issued, paid
 * or overdue invoice of its own partner. An invoice that is unknown, malformed or hidden is the same 404, so
 * nothing tells another partner's invoice from one that does not exist. The document is built from the
 * stored invoice, its lines and its settlement; nothing is written. The answer to a failure is the
 * standardized error shape, so the screen can say what went wrong and offer to try again.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Sign in to download this invoice.");
  }
  if (!hasAnyPermission(user.role, FINANCE_ACCESS_PERMISSIONS) || getPartnerAccessIssue(user) !== null) {
    return apiError("FORBIDDEN", "You cannot download this invoice.");
  }

  const { id } = await params;

  try {
    const invoice = await getInvoice(id, user.role === "partner_user");
    if (!invoice) {
      return apiError("NOT_FOUND", "Invoice not found.");
    }

    const pdf = await buildInvoicePdf(invoice);

    return new NextResponse(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoicePdfFileName(invoice.invoice_number)}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return apiError("INTERNAL_ERROR", "The PDF could not be built. Please try again.");
  }
}
