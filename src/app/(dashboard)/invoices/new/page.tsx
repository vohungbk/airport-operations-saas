import { requireRole } from "@/lib/auth/current-user";
import { GenerateInvoiceForm } from "@/features/invoices/components/generate-invoice-form";
import { getInvoiceablePeriods } from "@/features/invoices/lib/get-invoiceable-periods";
import { getSettlementPartners } from "@/features/settlements/lib/get-settlement-partners";

/**
 * VI-F09-S06: the Generate invoice screen, reached from the invoice list. Only an admin opens it, checked here before
 * anything is read; anyone else gets the 403 of this route (`forbidden.tsx`). RLS decides which partners and
 * settlements are read. This page itself writes nothing: the Server Action does, through a database function. A
 * failed read is thrown to the error boundary of the invoices.
 */
export default async function GenerateInvoicePage() {
  await requireRole(["admin"]);

  const [partners, periods] = await Promise.all([getSettlementPartners(), getInvoiceablePeriods()]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Generate invoice</h1>
      <GenerateInvoiceForm partners={partners} periods={periods} />
    </div>
  );
}
