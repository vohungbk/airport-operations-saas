import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildBookingsHref } from "@/features/bookings/lib/build-bookings-href";
import type { BookingsQuery } from "@/features/bookings/schemas/bookings-query.schema";

interface BookingsPaginationProps {
  query: BookingsQuery;
  total: number;
}

/** Server Component — plain prev/next links, no client JS. */
export function BookingsPagination({ query, total }: BookingsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / query.page_size));
  const first = total === 0 ? 0 : (query.page - 1) * query.page_size + 1;
  const last = Math.min(query.page * query.page_size, total);
  const hasPrev = query.page > 1;
  const hasNext = query.page < totalPages;
  const linkClass = cn(
    buttonVariants({ variant: "outline" }),
    "min-h-11 px-4 text-sm",
  );

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-2"
    >
      <p className="text-sm text-muted-foreground">
        Showing {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link
            href={buildBookingsHref(query, { page: query.page - 1 })}
            className={linkClass}
          >
            Previous
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={cn(linkClass, "pointer-events-none opacity-50")}
          >
            Previous
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildBookingsHref(query, { page: query.page + 1 })}
            className={linkClass}
          >
            Next
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={cn(linkClass, "pointer-events-none opacity-50")}
          >
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
