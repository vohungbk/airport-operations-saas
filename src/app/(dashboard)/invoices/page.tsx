import Link from "next/link";

import { PageEmpty } from "@/components/shared/page-state";
import { buttonVariants } from "@/components/ui/button";
import { requireAnyPermission } from "@/lib/auth/current-user";
import { FINANCE_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { ExportCsvLink } from "@/features/invoices/components/export-csv-link";
import { InvoicesEmpty } from "@/features/invoices/components/invoices-empty";
import { InvoicesFilters } from "@/features/invoices/components/invoices-filters";
import { InvoicesPagination } from "@/features/invoices/components/invoices-pagination";
import { InvoicesTable } from "@/features/invoices/components/invoices-table";
import { buildInvoicesExportHref } from "@/features/invoices/lib/build-invoices-href";
import { buildInvoiceRows } from "@/features/invoices/lib/invoice-list";
import { getInvoices } from "@/features/invoices/lib/get-invoices";
import {
  invoicesQuerySchema,
  resolveInvoicesQuery,
} from "@/features/invoices/schemas/invoices-query.schema";
import { utcToday } from "@/features/partners/lib/commercial-terms";
import { getSettlementPartners } from "@/features/settlements/lib/get-settlement-partners";

/** What the empty state says, which depends on whether a filter is on and on who is looking. */
function emptyMessage(isFiltered: boolean, isPartner: boolean): string {
  if (isFiltered) {
    return "Try a different invoice number, status, or period.";
  }

  return isPartner
    ? "Invoices appear here once they are issued to your organization."
    : "Invoices appear here once they are issued to a partner.";
}

interface InvoicesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The invoice list (VI-F09-S01). An admin, an operations manager (`finance:view`) and a partner user
 * (`finance:view_own_partner`) open it, checked here before anything is read; a technician gets the 403 of
 * this route. RLS decides which invoices each one gets: the partner of a partner user is never taken from the
 * address (its `partner_id` is dropped), and a partner is shown only issued, paid and overdue invoices. A
 * failed read is thrown to the error boundary, never shown as an empty list. An admin also gets the Generate invoice
 * button (VI-F09-S06); the screen it opens checks the role again.
 */
export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const user = await requireAnyPermission(FINANCE_ACCESS_PERMISSIONS);
  const isPartner = user.role === "partner_user";

  const requested = resolveInvoicesQuery(invoicesQuerySchema.parse(await searchParams), isPartner);
  const [result, partners] = await Promise.all([
    getInvoices(requested, isPartner),
    isPartner ? Promise.resolve([]) : getSettlementPartners(),
  ]);
  // An out-of-range page is served as the last valid page.
  const query = { ...requested, page: result.page };
  const isFiltered = Boolean(query.q || query.status || query.from || query.to || query.partner_id);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {isPartner ? "Invoices for your account" : "Invoices for all partners"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user.role === "admin" && (
            <Link href="/invoices/new" className={buttonVariants({ className: "min-h-11 px-4" })}>
              Generate invoice
            </Link>
          )}
          <ExportCsvLink href={buildInvoicesExportHref(query)} />
        </div>
      </div>

      <InvoicesFilters query={query} isPartner={isPartner} partners={partners} />

      {result.total === 0 ? (
        <InvoicesEmpty isFiltered={isFiltered}>
          <PageEmpty message={emptyMessage(isFiltered, isPartner)} className="max-w-sm" />
        </InvoicesEmpty>
      ) : (
        <>
          <InvoicesTable rows={buildInvoiceRows(result.invoices, utcToday())} query={query} showPartner={!isPartner} />
          <InvoicesPagination query={query} total={result.total} />
        </>
      )}
    </div>
  );
}
