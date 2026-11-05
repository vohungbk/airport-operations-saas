"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildInvoiceHistoryHref,
  HISTORY_TIME_ZONE_LABEL,
} from "@/features/invoices/lib/invoice-history";

interface InvoiceHistoryFiltersProps {
  /** The invoices the caller may pick, in order of number. */
  invoices: ReadonlyArray<{ id: string; invoice_number: string }>;
  /** The years the caller may pick, newest first. */
  years: readonly number[];
  invoiceId?: string;
  year: number;
}

const ALL_VALUE = "all";
const CARD_CLASS = "flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-5";

/**
 * The two fields of the Invoice history design (VI-F09-S10): Invoice number ("All invoices" or one invoice) and Period (a
 * year). A choice goes to the address, so the screen is the same when it is reloaded or shared. Only serializable
 * data crosses the boundary: the query was cleaned on the server.
 */
export function InvoiceHistoryFilters({ invoices, years, invoiceId, year }: InvoiceHistoryFiltersProps) {
  const router = useRouter();
  const selectedInvoice = invoices.some((invoice) => invoice.id === invoiceId) ? invoiceId : undefined;
  const yearItems = (years.includes(year) ? [...years] : [year, ...years]).map((value) => ({
    value: String(value),
    label: String(value),
  }));
  const invoiceItems = [
    { value: ALL_VALUE, label: "All invoices" },
    ...invoices.map((invoice) => ({ value: invoice.id, label: invoice.invoice_number })),
  ];
  const first = invoices[0]?.invoice_number;
  const last = invoices[invoices.length - 1]?.invoice_number;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className={CARD_CLASS}>
        <label htmlFor="history-invoice" className="text-sm font-semibold text-foreground">
          Invoice number
        </label>
        <Select
          value={selectedInvoice ?? ALL_VALUE}
          items={invoiceItems}
          onValueChange={(value) =>
            router.push(
              buildInvoiceHistoryHref({ invoice_id: !value || value === ALL_VALUE ? undefined : value, year }),
            )
          }
        >
          <SelectTrigger id="history-invoice" aria-label="Filter by invoice number" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {invoiceItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {first && last && <p className="text-sm text-muted-foreground">{`Search ${first} through ${last}`}</p>}
      </div>

      <div className={CARD_CLASS}>
        <label htmlFor="history-year" className="text-sm font-semibold text-foreground">
          Period
        </label>
        <Select
          value={String(year)}
          items={yearItems}
          onValueChange={(value) => router.push(buildInvoiceHistoryHref({ invoice_id: selectedInvoice, year: Number(value) }))}
        >
          <SelectTrigger id="history-year" aria-label="Filter by year" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{`Read-only audit history / ${HISTORY_TIME_ZONE_LABEL}`}</p>
      </div>
    </div>
  );
}
