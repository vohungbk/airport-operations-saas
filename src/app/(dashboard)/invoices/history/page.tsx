import { requireAnyPermission } from "@/lib/auth/current-user";
import { FINANCE_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { InvoiceHistoryFilters } from "@/features/invoices/components/invoice-history-filters";
import { InvoiceHistoryList } from "@/features/invoices/components/invoice-history-list";
import { getInvoiceHistory } from "@/features/invoices/lib/get-invoice-history";
import { currentHistoryYear } from "@/features/invoices/lib/invoice-history";
import { invoiceHistoryQuerySchema } from "@/features/invoices/schemas/invoice-history-query.schema";

interface InvoiceHistoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The history of the invoices and of their status changes (VI-F09-S10, NAV-5). An admin, an operations manager and a
 * partner user open it, checked here before anything is read; a technician gets the 403 of this route. The database
 * decides what each one is given (a partner user only the events of its own issued, paid or overdue invoices), so the
 * address cannot widen it. A failed read is thrown to the error boundary, never shown as an empty history.
 */
export default async function InvoiceHistoryPage({ searchParams }: InvoiceHistoryPageProps) {
  const user = await requireAnyPermission(FINANCE_ACCESS_PERMISSIONS);

  const query = invoiceHistoryQuerySchema.parse(await searchParams);
  const currentYear = currentHistoryYear();
  const year = query.year ?? currentYear;
  const history = await getInvoiceHistory({ ...query, year }, user.role === "partner_user", currentYear);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Invoice history</h1>

      <InvoiceHistoryFilters invoices={history.invoices} years={history.years} invoiceId={query.invoice_id} year={year} />

      <InvoiceHistoryList rows={history.rows} />
    </div>
  );
}
