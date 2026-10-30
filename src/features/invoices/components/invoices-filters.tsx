"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { InvoicesPeriodField } from "@/features/invoices/components/invoices-period-field";
import { buildInvoicesHref } from "@/features/invoices/lib/build-invoices-href";
import {
  INVOICE_STATUS_LABEL,
  visibleInvoiceStatuses,
  type InvoiceStatus,
} from "@/features/invoices/lib/invoice-list";
import type { ResolvedInvoicesQuery } from "@/features/invoices/schemas/invoices-query.schema";

interface InvoicesFiltersProps {
  query: ResolvedInvoicesQuery;
  isPartner: boolean;
  /** The partners an operations user may filter by; empty for a partner user, who has no such filter. */
  partners: ReadonlyArray<{ value: string; label: string }>;
}

const ALL_VALUE = "all";
/** The cards of the design are as tall as each other, with room under the field. */
const CARD_CLASS = "flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-5 sm:min-h-50";

function FilterLabel({ htmlFor, name, hint }: { htmlFor: string; name: string; hint: string }) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1">
      <span className="text-sm tracking-wide text-muted-foreground uppercase">{name}</span>
      <span className="text-base font-semibold text-foreground">{hint}</span>
    </label>
  );
}

/**
 * The filters of the invoice list, as the design lays them out: Invoice number, Status, Period and (for the
 * operations team) Partner, each in a card, and Clear filters. The search applies when Enter is pressed or
 * the box is left, the period when its box is closed, the status and the partner when chosen. Every change
 * goes back to page 1 and keeps the sort and the page size. Only serializable data crosses the boundary:
 * the query was cleaned on the server.
 */
export function InvoicesFilters({ query, isPartner, partners }: InvoicesFiltersProps) {
  const router = useRouter();
  const [search, setSearch] = useState(query.q ?? "");
  const isFiltered = Boolean(query.q || query.status || query.from || query.to || query.partner_id);

  function go(change: Partial<ResolvedInvoicesQuery>) {
    router.push(buildInvoicesHref({ ...query, ...change }, { page: 1 }));
  }

  function applySearch() {
    const next = search.trim() || undefined;

    if (next !== query.q) {
      go({ q: next });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applySearch();
  }

  const statusItems = [
    { value: ALL_VALUE, label: "All statuses" },
    ...visibleInvoiceStatuses(isPartner).map((value) => ({ value, label: INVOICE_STATUS_LABEL[value] })),
  ];
  const partnerItems = [{ value: ALL_VALUE, label: "All partners" }, ...partners];

  return (
    <div className="flex flex-wrap items-stretch gap-3">
      <div className={cn(CARD_CLASS, "w-full sm:w-80")}>
        <FilterLabel htmlFor="invoice-q" name="Invoice number" hint="Search invoice number" />
        <form onSubmit={handleSubmit} role="search">
          <SearchInput
            id="invoice-q"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onBlur={applySearch}
            placeholder="Search invoices"
            className="h-11"
            maxLength={40}
          />
        </form>
      </div>

      <div className={cn(CARD_CLASS, "w-full sm:w-56")}>
        <FilterLabel htmlFor="invoice-status" name="Status" hint="All statuses" />
        <Select
          value={query.status ?? ALL_VALUE}
          items={statusItems}
          onValueChange={(value) => go({ status: !value || value === ALL_VALUE ? undefined : (value as InvoiceStatus) })}
        >
          <SelectTrigger id="invoice-status" aria-label="Filter by status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={cn(CARD_CLASS, "w-full sm:w-80")}>
        <FilterLabel htmlFor="invoice-period" name="Period" hint="From month / To month" />
        <InvoicesPeriodField
          id="invoice-period"
          from={query.from ?? ""}
          to={query.to ?? ""}
          onApply={(period) => go({ from: period.from || undefined, to: period.to || undefined })}
        />
      </div>

      {!isPartner && (
        <div className={cn(CARD_CLASS, "w-full sm:w-56")}>
          <FilterLabel htmlFor="invoice-partner" name="Partner" hint="All partners" />
          <Select
            value={query.partner_id ?? ALL_VALUE}
            items={partnerItems}
            onValueChange={(value) => go({ partner_id: !value || value === ALL_VALUE ? undefined : value })}
          >
            <SelectTrigger id="invoice-partner" aria-label="Filter by partner" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {partnerItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Link
        href="/invoices"
        aria-disabled={!isFiltered}
        className={buttonVariants({
          variant: "outline",
          className: cn("min-h-11 min-w-32 self-end px-4", !isFiltered && "pointer-events-none opacity-50"),
        })}
      >
        Clear filters
      </Link>
    </div>
  );
}
