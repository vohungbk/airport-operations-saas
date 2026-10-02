import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildSeatsHref } from "@/features/seats/lib/build-seats-href";
import type { SeatsQuery } from "@/features/seats/schemas/seats-query.schema";

interface SeatsPaginationProps {
  query: SeatsQuery;
  total: number;
}

/** Server Component — plain prev/next links, no client JS. */
export function SeatsPagination({ query, total }: SeatsPaginationProps) {
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
        Page {query.page} of {totalPages} ({total} seat
        {total === 1 ? "" : "s"})
      </p>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link
            href={buildSeatsHref(query, { page: query.page - 1 })}
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
            href={buildSeatsHref(query, { page: query.page + 1 })}
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
