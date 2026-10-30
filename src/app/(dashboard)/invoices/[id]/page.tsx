import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { requireAnyPermission } from "@/lib/auth/current-user";
import { FINANCE_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { InvoiceDetail } from "@/features/invoices/components/invoice-detail";
import { buildInvoiceDetail } from "@/features/invoices/lib/invoice-detail";
import { getInvoice } from "@/features/invoices/lib/get-invoice";
import { utcToday } from "@/features/partners/lib/commercial-terms";

interface InvoicePageProps {
  params: Promise<{ id: string }>;
}

/**
 * One invoice (VI-F09-S01, NAV-1). The permission is checked before anything is read; RLS then gives a
 * partner user only an invoice of its own partner. An invoice that is unknown, malformed or hidden is the
 * same not-found page, so nothing tells another partner's invoice from one that does not exist.
 */
export default async function InvoicePage({ params }: InvoicePageProps) {
  const user = await requireAnyPermission(FINANCE_ACCESS_PERMISSIONS);

  const { id } = await params;
  const invoice = await getInvoice(id, user.role === "partner_user");

  if (!invoice) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Invoice detail</h1>
        <Link href="/invoices" className={buttonVariants({ variant: "outline", className: "min-h-11 px-4" })}>
          Back to invoices
        </Link>
      </div>
      <InvoiceDetail view={buildInvoiceDetail(invoice, utcToday())} />
    </div>
  );
}
