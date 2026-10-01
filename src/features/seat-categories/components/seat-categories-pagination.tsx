import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SeatCategoriesQuery } from "@/features/seat-categories/schemas/seat-categories-query.schema";

interface SeatCategoriesPaginationProps {
  query: SeatCategoriesQuery;
  total: number;
}

function buildPageHref(query: SeatCategoriesQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  params.set("sort", query.sort);
  params.set("order", query.order);
  params.set("page", String(page));
  params.set("page_size", String(query.page_size));
  return `/seat-categories?${params.toString()}`;
}

/** Server Component — plain prev/next links, no client JS. */
export function SeatCategoriesPagination({
  query,
  total,
}: SeatCategoriesPaginationProps) {
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
        Page {query.page} of {totalPages} ({total} seat categor
        {total === 1 ? "y" : "ies"})
      </p>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link href={buildPageHref(query, query.page - 1)} className={linkClass}>
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
          <Link href={buildPageHref(query, query.page + 1)} className={linkClass}>
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
