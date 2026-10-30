import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InvoicesPageSize } from "@/features/invoices/components/invoices-page-size";
import { buildInvoicesHref } from "@/features/invoices/lib/build-invoices-href";
import { showingText } from "@/features/invoices/lib/invoice-list";
import type { ResolvedInvoicesQuery } from "@/features/invoices/schemas/invoices-query.schema";

interface InvoicesPaginationProps {
  query: ResolvedInvoicesQuery;
  total: number;
}

/** "Showing 1–9 of 9", previous and next links, and the page size (no client JS but the size menu). */
export function InvoicesPagination({ query, total }: InvoicesPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / query.page_size));
  const linkClass = buttonVariants({ variant: "outline", className: "min-h-11 px-4" });
  const steps = [
    { label: "Previous", page: query.page - 1, enabled: query.page > 1 },
    { label: "Next", page: query.page + 1, enabled: query.page < totalPages },
  ];

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{showingText(query.page, query.page_size, total)}</p>
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step) =>
          step.enabled ? (
            <Link key={step.label} href={buildInvoicesHref(query, { page: step.page })} className={linkClass}>
              {step.label}
            </Link>
          ) : (
            <span key={step.label} aria-disabled="true" className={cn(linkClass, "pointer-events-none opacity-50")}>
              {step.label}
            </span>
          ),
        )}
        <InvoicesPageSize query={query} />
      </div>
    </nav>
  );
}
