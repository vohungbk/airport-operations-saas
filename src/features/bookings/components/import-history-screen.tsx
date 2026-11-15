import type { ReactNode } from "react";

import { TextLink } from "@/components/ui/text-link";
import { ImportHistoryFiltersBar } from "@/features/bookings/components/import-history-filters";
import type { ImportHistoryFilters } from "@/features/bookings/lib/booking-import-history";
import type { BookingImportFilterOptions } from "@/features/bookings/lib/get-booking-imports";

interface ImportHistoryScreenProps {
  filters: ImportHistoryFilters;
  options: BookingImportFilterOptions;
  children: ReactNode;
}

/** CO-F07-S07 (design "Import history"): the way back, the filters, the register card and the note at the bottom. */
export function ImportHistoryScreen({ filters, options, children }: ImportHistoryScreenProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4">
        <TextLink href="/bookings/import" className="w-fit px-0 text-xs">
          Back to import bookings
        </TextLink>
        <ImportHistoryFiltersBar filters={filters} partners={options.partners} actors={options.actors} />
      </div>

      <section
        aria-labelledby="import-register-title"
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground md:p-6"
      >
        <div className="flex flex-col gap-2">
          <h2 id="import-register-title" className="text-base font-semibold text-foreground">
            Import register
          </h2>
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
            Newest imports first · Imported at ↓
          </p>
        </div>
        {children}
      </section>

      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
        Import history is kept and cannot be deleted.
      </p>
    </div>
  );
}
