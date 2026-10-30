import { Inbox } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

interface InvoicesEmptyProps {
  /** A filter is on: the list is empty because nothing matched, not because there is nothing. */
  isFiltered: boolean;
  isPartner: boolean;
}

/** The two empty states of the design: no invoice yet, and no invoice that matches the filters. */
export function InvoicesEmpty({ isFiltered, isPartner }: InvoicesEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox aria-hidden="true" className="size-5" />
      </span>
      <p className="text-sm font-semibold text-foreground">
        {isFiltered ? "No invoices match your filters" : "No invoices yet"}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {isFiltered
          ? "Try a different invoice number, status, or period."
          : isPartner
            ? "Invoices appear here once they are issued to your organization."
            : "Invoices appear here once they are issued to a partner."}
      </p>
      {isFiltered && (
        <Link href="/invoices" className={buttonVariants({ className: "min-h-11 px-4" })}>
          Clear filters
        </Link>
      )}
    </div>
  );
}
