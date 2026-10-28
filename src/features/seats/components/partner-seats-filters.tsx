import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SEAT_STATUSES,
  SEAT_STATUS_LABEL,
} from "@/features/seats/lib/seat-status";
import type { PartnerSeatsQuery } from "@/features/seats/schemas/partner-seats-query.schema";

interface PartnerSeatsFiltersProps {
  query: PartnerSeatsQuery;
}

const SELECT_CLASS =
  "h-11 w-full sm:w-40 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/**
 * Server Component: a plain GET form, so it needs no client JS. A new search
 * or status goes back to page 1; the sort is kept.
 */
export function PartnerSeatsFilters({ query }: PartnerSeatsFiltersProps) {
  const isFiltered = Boolean(query.q || query.status);

  return (
    <form
      method="get"
      action="/partner/seats"
      role="search"
      className="flex flex-wrap items-center gap-2"
    >
      <Input
        name="q"
        defaultValue={query.q ?? ""}
        placeholder="Search by serial number..."
        className="h-11 w-full sm:w-72"
        aria-label="Search seats"
      />
      <select
        name="status"
        defaultValue={query.status ?? ""}
        className={SELECT_CLASS}
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        {SEAT_STATUSES.map((value) => (
          <option key={value} value={value}>
            {SEAT_STATUS_LABEL[value]}
          </option>
        ))}
      </select>
      <input type="hidden" name="sort" value={query.sort} />
      <input type="hidden" name="order" value={query.order} />
      <Button type="submit" variant="outline" className="min-h-11 px-4">
        Search
      </Button>
      {isFiltered && (
        <Link
          href="/partner/seats"
          className={buttonVariants({
            variant: "ghost",
            className: "min-h-11 px-4",
          })}
        >
          Clear
        </Link>
      )}
    </form>
  );
}
