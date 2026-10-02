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
  const hasPrev = query.page > 1;
  const hasNext = query.page < totalPages;
  const linkClass = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-2"
    >
      <p className="text-sm text-muted-foreground">
        Page {query.page} of {totalPages} ({total} booking
        {total === 1 ? "" : "s"})
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
