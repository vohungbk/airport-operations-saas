import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { FINANCE_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { InvoiceDetail } from "@/features/invoices/components/invoice-detail";
import { buildInvoiceDetail } from "@/features/invoices/lib/invoice-detail";
import { getInvoice } from "@/features/invoices/lib/get-invoice";

interface InvoicePageProps {
  params: Promise<{ id: string }>;
}

/**
 * One invoice with its lines (VI-F09-S01, S03, NAV-1). The permission is checked before anything is read; RLS then gives a
 * partner user only an invoice of its own partner. An invoice that is unknown, malformed or hidden is the
 * same not-found page, so nothing tells another partner's invoice from one that does not exist.
 */
export default async function InvoicePage({ params }: InvoicePageProps) {
  const user = await requireAnyPermission(FINANCE_ACCESS_PERMISSIONS);

  const { id } = await params;
  const isPartner = user.role === "partner_user";
  const invoice = await getInvoice(id, isPartner);

  if (!invoice) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <InvoiceDetail view={buildInvoiceDetail(invoice, !isPartner)} invoiceId={invoice.id} />
    </div>
  );
}
