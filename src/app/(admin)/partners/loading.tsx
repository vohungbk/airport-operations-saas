import { Skeleton } from "@/components/ui/skeleton";
import { PartnersPageHeader } from "@/features/partners/components/partners-page-header";
import { PartnersSearch } from "@/features/partners/components/partners-search";
import { PARTNERS_DEFAULT_PAGE_SIZE } from "@/features/partners/schemas/partners-query.schema";

const ROWS = Array.from({ length: PARTNERS_DEFAULT_PAGE_SIZE }, (_, index) => index);

export default function PartnersLoading() {
  return (
    <div
      className="flex flex-1 flex-col gap-6 p-4 sm:p-8"
      role="status"
      aria-busy="true"
      aria-label="Loading partners"
    >
      <PartnersPageHeader />
      <PartnersSearch query={null} />

      <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
        <ul className="flex flex-col gap-3 p-3 sm:hidden">
          {ROWS.map((row) => (
            <li key={row} className="flex flex-col items-start gap-2 rounded-lg border bg-card p-4">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-5 w-14" />
            </li>
          ))}
        </ul>
        <div className="hidden grid-cols-[1fr_2fr_2fr_1fr] gap-6 bg-surface-muted px-6 py-4 sm:grid">
          {["Partner code", "Partner name", "Contact", "Status"].map((label) => (
            <span key={label} className="text-xs font-medium text-text-muted uppercase sm:text-sm">
              {label}
            </span>
          ))}
        </div>
        {ROWS.map((row) => (
          <div
            key={row}
            className="hidden h-14 grid-cols-[1fr_2fr_2fr_1fr] items-center gap-6 border-b px-6 last:border-b-0 sm:grid"
          >
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-11 w-64 max-w-full" />
        </div>
      </div>
    </div>
  );
}
